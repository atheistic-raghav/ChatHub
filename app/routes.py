from flask import Blueprint, request, session, jsonify
from flask_cors import cross_origin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, socketio
from app.models import User, Message, Friendship, PrivateMessage, Ban, Kick
from datetime import datetime, timedelta, timezone
from flask_socketio import emit, join_room, leave_room

main = Blueprint('main', __name__)

# Global state management for sockets
sid_to_user = {}  # Maps socket ID to user data
room_users = {}   # Maps room name to set of usernames
user_to_sid = {}  # Maps username to socket ID (for cleanup)

# Available public chat rooms
CHAT_ROOMS = [
    'Chat Room 1',
    'Chat Room 2',
    'Chat Room 3',
    'Chat Room 4',
    'Chat Room 5'
]

def get_private_room_name(user1, user2):
    """Consistent name for private chat room."""
    return '_'.join(sorted([user1, user2]))

def prune_old_messages():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    Message.query.filter(Message.timestamp < cutoff).delete()
    db.session.commit()

def is_kicked(user):
    kick = Kick.query.filter_by(user_id=user.id).first()
    return kick and datetime.utcnow() < kick.kicked_at + timedelta(hours=12)

def to_ist_string(dt):
    """Convert UTC datetime to IST string."""
    ist = timezone(timedelta(hours=5, minutes=30))
    return dt.astimezone(ist).strftime('%H:%M:%S')

def create_system_message(mod_username, action, target_username):
    """Create and broadcast a system moderation message to ALL chat rooms"""
    if action == 'kick':
        content = f"{mod_username} 🔥MOD kicked {target_username} for 12 hours"
    elif action == 'ban':
        content = f"{mod_username} 🔥MOD banned {target_username} permanently"

    # Create system user if it doesn't exist
    system_user = User.query.filter_by(username='SYSTEM').first()
    if not system_user:
        system_user = User(
            username='SYSTEM',
            password_hash='no-password-system-user',
            is_mod=True
        )
        db.session.add(system_user)
        db.session.commit()

    # Create system message in ALL chat rooms
    for room_name in CHAT_ROOMS:
        system_msg = Message(
            user_id=system_user.id,
            content=content,
            timestamp=datetime.utcnow(),
            room_name=room_name
        )
        db.session.add(system_msg)
    
    db.session.commit()

    # Broadcast system message to ALL chat rooms
    for room_name in CHAT_ROOMS:
        socketio.emit('receive_message', {
            'id': system_msg.id,
            'username': 'SYSTEM',
            'content': content,
            'timestamp': datetime.utcnow().isoformat(),
            'is_mod': True,
            'is_system': True,
            'room_name': room_name
        }, room=room_name)

def broadcast_online_users(room_name):
    """Broadcast online users list to a specific room"""
    if room_name not in room_users:
        room_users[room_name] = set()
    
    online_users_with_status = []
    for username in list(room_users[room_name]):
        user_obj = User.query.filter_by(username=username).first()
        if user_obj and user_obj.username != 'SYSTEM':
            online_users_with_status.append({
                'username': username,
                'is_mod': user_obj.is_mod
            })
    
    print(f"🔄 Broadcasting {len(online_users_with_status)} online users to room '{room_name}': {[u['username'] for u in online_users_with_status]}")
    
    socketio.emit('online_users', online_users_with_status, room=room_name)

# ============================================================================
# API ROUTES FOR REACT FRONTEND
# ============================================================================

@main.route('/api/health')
@cross_origin()
def api_health():
    return jsonify({'status': 'ok'}), 200

@main.route('/api/auth/login', methods=['POST'])
@cross_origin()
def api_login():
    """API endpoint for React login"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400
            
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'message': 'Username and password are required'}), 400
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            session['user'] = user.username
            return jsonify({
                'access_token': 'dummy_token_' + user.username,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'is_mod': user.is_mod,
                    'created_at': user.created_at.isoformat()
                }
            }), 200
        
        return jsonify({'message': 'Invalid username or password'}), 401
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'message': 'Server error during login'}), 500

@main.route('/api/auth/register', methods=['POST'])
@cross_origin()
def api_register():
    """API endpoint for React registration"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'message': 'Username and password are required'}), 400
        
        if username.upper() == 'SYSTEM':
            return jsonify({'message': 'Username "SYSTEM" is reserved'}), 400
        
        existing_user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
        if existing_user:
            return jsonify({'message': 'Username already taken'}), 409
        
        hashed_password = generate_password_hash(password)
        user = User(username=username, password_hash=hashed_password)
        db.session.add(user)
        db.session.commit()
        
        return jsonify({'message': 'Account created successfully'}), 201
    except Exception as e:
        print(f"Register error: {e}")
        return jsonify({'message': 'Server error during registration'}), 500

@main.route('/api/auth/me', methods=['GET'])
@cross_origin()
def api_get_current_user():
    """Get current user info"""
    try:
        if 'user' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        user = User.query.filter_by(username=session['user']).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'id': user.id,
            'username': user.username,
            'is_mod': user.is_mod,
            'created_at': user.created_at.isoformat()
        })
    except Exception as e:
        print(f"Get current user error: {e}")
        return jsonify({'error': 'Server error'}), 500

@main.route('/api/auth/logout', methods=['POST'])
@cross_origin()
def api_logout():
    """Log out current user by clearing session"""
    session.pop('user', None)
    return jsonify({'message': 'Logged out'})

@main.route('/api/mod/kick', methods=['POST'])
@cross_origin()
def api_kick_user():
    """Kick a user for 12 hours (moderators only)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json() or {}
    target_username = (data.get('username') or '').strip()
    
    if not target_username:
        return jsonify({'error': 'Username is required'}), 400
    
    mod_user = User.query.filter_by(username=session['user']).first()
    if not mod_user or not mod_user.is_mod:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if target_username == mod_user.username:
        return jsonify({'error': 'Cannot moderate yourself'}), 400
    
    target = User.query.filter_by(username=target_username).first()
    if not target:
        return jsonify({'error': 'User not found'}), 404
    
    existing_kick = Kick.query.filter_by(user_id=target.id).first()
    if existing_kick:
        existing_kick.kicked_at = datetime.utcnow()
    else:
        new_kick = Kick(user_id=target.id, kicked_at=datetime.utcnow())
        db.session.add(new_kick)
    
    db.session.commit()
    create_system_message(mod_user.username, 'kick', target_username)
    
    return jsonify({'message': f'{target_username} has been kicked for 12 hours.'})

@main.route('/api/mod/ban', methods=['POST'])
@cross_origin()
def api_ban_user():
    """Ban a user permanently (moderators only)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json() or {}
    target_username = (data.get('username') or '').strip()
    
    if not target_username:
        return jsonify({'error': 'Username is required'}), 400
    
    mod_user = User.query.filter_by(username=session['user']).first()
    if not mod_user or not mod_user.is_mod:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if target_username == mod_user.username:
        return jsonify({'error': 'Cannot moderate yourself'}), 400
    
    target = User.query.filter_by(username=target_username).first()
    if not target:
        return jsonify({'error': 'User not found'}), 404
    
    existing_ban = Ban.query.filter_by(user_id=target.id).first()
    if existing_ban:
        return jsonify({'message': f'{target_username} is already banned.'}), 200
    
    new_ban = Ban(user_id=target.id, banned_at=datetime.utcnow())
    db.session.add(new_ban)
    db.session.commit()
    
    create_system_message(mod_user.username, 'ban', target_username)
    
    return jsonify({'message': f'{target_username} has been banned permanently.'})

@main.route('/api/rooms')
@cross_origin()
def api_get_rooms():
    """API endpoint to get available chat rooms"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify({
        'rooms': CHAT_ROOMS,
        'user': session['user']
    })

@main.route('/api/chat/messages/<room_name>')
@cross_origin()
def api_get_messages(room_name):
    """API endpoint to get messages for a specific room"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    if room_name not in CHAT_ROOMS:
        return jsonify({'error': 'Invalid room'}), 404
    
    # Get recent messages (last 50)
    messages = Message.query.filter_by(room_name=room_name)\
        .order_by(Message.timestamp.desc())\
        .limit(50)\
        .all()
    
    messages = list(reversed(messages))
    
    IST_OFFSET = timedelta(hours=5, minutes=30)
    return jsonify([{
        'id': msg.id,
        'username': msg.user.username,
        'content': msg.content,
        'timestamp': (msg.timestamp + IST_OFFSET).isoformat(),
        'is_mod': msg.user.is_mod,
        'is_system': msg.user.username == 'SYSTEM',
        'room_name': room_name
    } for msg in messages])

@main.route('/api/chat/messages/<room_name>', methods=['POST'])
@cross_origin()
def api_send_message(room_name):
    """API endpoint to send a message to a specific room (REST fallback)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    if room_name not in CHAT_ROOMS:
        return jsonify({'error': 'Invalid room'}), 404
    
    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    user = User.query.filter_by(username=session['user']).first()
    if not user or Ban.query.filter_by(user_id=user.id).first() or is_kicked(user):
        return jsonify({'error': 'Not allowed to send messages'}), 403
    
    msg = Message(
        user_id=user.id,
        content=content,
        timestamp=datetime.utcnow(),
        room_name=room_name
    )
    db.session.add(msg)
    db.session.commit()
    
    payload = {
        'id': msg.id,
        'username': user.username,
        'content': content,
        'timestamp': msg.timestamp.isoformat(),
        'is_mod': user.is_mod,
        'is_system': False,
        'room_name': room_name
    }
    
    print(f"📤 REST fallback: Broadcasting message to room '{room_name}': {content[:50]}...")
    socketio.emit('receive_message', payload, room=room_name)
    
    return jsonify(payload), 201

@main.route('/api/friends')
@cross_origin()
def api_get_friends():
    """API endpoint to get friends and friend requests"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    current_user = User.query.filter_by(username=session['user']).first()
    friends = current_user.get_friends()
    friend_requests = current_user.get_friend_requests()
    
    return jsonify({
        'friends': [{
            'id': friend.id,
            'username': friend.username,
            'is_mod': friend.is_mod,
            'created_at': friend.created_at.isoformat()
        } for friend in friends],
        'friend_requests': [{
            'id': req.id,
            'sender': {
                'id': req.sender.id,
                'username': req.sender.username,
                'is_mod': req.sender.is_mod
            },
            'created_at': req.created_at.isoformat()
        } for req in friend_requests]
    })

@main.route('/api/users/search', methods=['POST'])
@cross_origin()
def api_search_users():
    """API endpoint for user search"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    term = data.get('search_term', '').strip()
    current_user = User.query.filter_by(username=session['user']).first()
    
    if not term:
        return jsonify({'users': []})
    
    users = User.query.filter(
        User.username.ilike(f'%{term}%'),
        User.id != current_user.id,
        User.username != 'SYSTEM'
    ).all()
    
    return jsonify({
        'users': [{
            'id': user.id,
            'username': user.username,
            'is_mod': user.is_mod,
            'created_at': user.created_at.isoformat()
        } for user in users]
    })

@main.route('/api/friends/request/<int:user_id>', methods=['POST'])
@cross_origin()
def api_send_friend_request(user_id):
    """API endpoint to send friend request"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    current_user = User.query.filter_by(username=session['user']).first()
    target_user = User.query.get_or_404(user_id)
    
    existing = Friendship.query.filter(
        ((Friendship.sender_id == current_user.id) & (Friendship.receiver_id == target_user.id)) |
        ((Friendship.sender_id == target_user.id) & (Friendship.receiver_id == current_user.id)),
        Friendship.status.in_(['pending', 'accepted'])
    ).first()
    
    if existing:
        return jsonify({'error': 'Friendship or request already exists'}), 400
    
    new_request = Friendship(sender_id=current_user.id, receiver_id=target_user.id, status='pending')
    db.session.add(new_request)
    db.session.commit()
    
    return jsonify({'message': f'Friend request sent to {target_user.username}'})

@main.route('/api/friends/accept/<int:request_id>', methods=['POST'])
@cross_origin()
def api_accept_friend_request(request_id):
    """API endpoint to accept friend request"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    current_user = User.query.filter_by(username=session['user']).first()
    friend_request = Friendship.query.get_or_404(request_id)
    
    if friend_request.receiver_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    friend_request.status = 'accepted'
    friend_request.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': f'You are now friends with {friend_request.sender.username}'})

@main.route('/api/friends/reject/<int:request_id>', methods=['POST'])
@cross_origin()
def api_reject_friend_request(request_id):
    """API endpoint to reject friend request"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    current_user = User.query.filter_by(username=session['user']).first()
    friend_request = Friendship.query.get_or_404(request_id)
    
    if friend_request.receiver_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    friend_request.status = 'rejected'
    friend_request.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Friend request rejected'})

@main.route('/api/friends/messages/<int:friend_id>')
@cross_origin()
def api_get_private_messages(friend_id):
    """API endpoint to get private messages with a friend"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    current_user = User.query.filter_by(username=session['user']).first()
    friend = User.query.get_or_404(friend_id)
    
    if not current_user.is_friend_with(friend):
        return jsonify({'error': 'You can only chat with friends'}), 403
    
    messages_raw = PrivateMessage.query.filter(
        ((PrivateMessage.sender_id == current_user.id) & (PrivateMessage.receiver_id == friend.id)) |
        ((PrivateMessage.sender_id == friend.id) & (PrivateMessage.receiver_id == current_user.id))
    ).order_by(PrivateMessage.timestamp).all()
    
    IST_OFFSET = timedelta(hours=5, minutes=30)
    return jsonify([{
        'id': msg.id,
        'sender': {
            'id': msg.sender.id,
            'username': msg.sender.username,
            'is_mod': msg.sender.is_mod
        },
        'content': msg.content,
        'timestamp': (msg.timestamp + IST_OFFSET).isoformat(),
        'read': msg.read
    } for msg in messages_raw])

@main.route('/api/friends/messages/<int:friend_id>', methods=['POST'])
@cross_origin()
def api_send_private_message(friend_id):
    """API endpoint to send a private message (REST fallback)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    current_user = User.query.filter_by(username=session['user']).first()
    friend = User.query.get_or_404(friend_id)
    
    if not current_user.is_friend_with(friend):
        return jsonify({'error': 'You can only chat with friends'}), 403
    
    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    pm = PrivateMessage(sender_id=current_user.id, receiver_id=friend.id, content=content, timestamp=datetime.utcnow())
    db.session.add(pm)
    db.session.commit()
    
    room = get_private_room_name(current_user.username, friend.username)
    payload = {
        'id': pm.id,
        'from': current_user.username,
        'to': friend.username,
        'content': content,
        'timestamp': pm.timestamp.isoformat(),
        'is_mod': current_user.is_mod
    }
    
    socketio.emit('receive_private_message', payload, room=room)
    
    return jsonify(payload), 201

# ============================================================================
# SOCKETIO HANDLERS - VERSION COMPATIBLE WITH FLASK-SOCKETIO 5.3.6
# ============================================================================

@socketio.on('connect')
def on_connect():
    from flask import request as flask_request
    sid = flask_request.sid
    print(f"🔌 Socket {sid} connected")

@socketio.on('disconnect')
def on_disconnect():
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.pop(sid, None)
    
    if user_data:
        username = user_data['username']
        print(f"🔌 Socket {sid} disconnected - User: {username}")
        
        # Remove from username mapping
        if username in user_to_sid and user_to_sid[username] == sid:
            del user_to_sid[username]
        
        # Remove from all rooms and broadcast updates
        for room_name in CHAT_ROOMS:
            if room_name in room_users and username in room_users[room_name]:
                room_users[room_name].discard(username)
                print(f"🚪 Removed {username} from room {room_name}")
                
                # Broadcast updated online users
                broadcast_online_users(room_name)
                
                # Notify room that user left
                emit('user_left', {'username': username}, room=room_name)

@socketio.on('user_connected')
def on_user_connected(data):
    """Handle user connecting to a specific room"""
    from flask import request as flask_request
    sid = flask_request.sid
    username = data.get('username')
    room_name = data.get('room_name', 'Chat Room 1')
    
    if not username or room_name not in CHAT_ROOMS:
        print(f"❌ Invalid user_connected data: {data}")
        return
    
    # Verify user exists in database
    user = User.query.filter_by(username=username).first()
    if not user:
        print(f"❌ User {username} not found in database")
        return
    
    print(f"🎯 User {username} connecting to room {room_name} (Socket: {sid})")
    
    # Store user data for this socket
    sid_to_user[sid] = {
        'username': username,
        'user_id': user.id,
        'is_mod': user.is_mod,
        'current_room': room_name
    }
    
    # Update username to socket mapping
    user_to_sid[username] = sid
    
    # Initialize room if needed
    if room_name not in room_users:
        room_users[room_name] = set()
    
    # Add user to room tracking
    room_users[room_name].add(username)
    
    # Join the socket room
    join_room(room_name, sid=sid)
    
    print(f"✅ {username} joined room {room_name}. Room now has: {list(room_users[room_name])}")
    
    # Broadcast updated online users list
    broadcast_online_users(room_name)
    
    # Notify room that user joined
    emit('user_joined', {'username': username}, room=room_name)

@socketio.on('send_message')
def handle_send_message(data):
    """Handle sending a message to a room"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)
    
    if not user_data:
        print(f"❌ No user data for socket {sid}")
        return
    
    username = user_data['username']  # Use the username from socket session
    content = data.get('content', '').strip()
    room_name = data.get('room_name', user_data.get('current_room', 'Chat Room 1'))
    
    # Verify data
    if not content or room_name not in CHAT_ROOMS:
        print(f"❌ Invalid message data: {data}")
        return
    
    # Get user from database
    user = User.query.filter_by(username=username).first()
    if not user or Ban.query.filter_by(user_id=user.id).first() or is_kicked(user):
        print(f"❌ User {username} is banned/kicked or not found")
        return
    
    print(f"💬 {username} sending message to {room_name}: {content[:50]}...")
    
    # Create message in database
    msg = Message(
        user_id=user.id,
        content=content,
        timestamp=datetime.utcnow(),
        room_name=room_name
    )
    db.session.add(msg)
    db.session.commit()
    
    # Broadcast message to room
    payload = {
        'id': msg.id,
        'username': username,
        'content': content,
        'timestamp': msg.timestamp.isoformat(),
        'is_mod': user.is_mod,
        'is_system': False,
        'room_name': room_name
    }
    
    print(f"📤 Broadcasting message to room {room_name}")
    emit('receive_message', payload, room=room_name)
    # Also send to sender for immediate feedback
    emit('receive_message', payload, room=sid)

@socketio.on('leave')
def on_leave(data):
    """Handle user leaving a room"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)
    
    if not user_data:
        return
    
    username = data.get('username')
    room = data.get('room')
    
    if username != user_data['username']:
        return
    
    print(f"🚪 {username} leaving room {room}")
    
    # Leave the socket room
    leave_room(room, sid=sid)
    
    # Remove from room tracking
    if room in room_users and username in room_users[room]:
        room_users[room].discard(username)
        
        # Broadcast updated online users
        broadcast_online_users(room)
        
        # Notify room that user left
        emit('user_left', {'username': username}, room=room)

@socketio.on('who_is_online')
def who_is_online(data):
    """Handle request for online users in a room"""
    from flask import request as flask_request
    sid = flask_request.sid
    room_name = data.get('room_name', 'Chat Room 1')
    
    print(f"📋 Online users request for room {room_name}")
    
    if room_name not in room_users:
        room_users[room_name] = set()
    
    online_users_with_status = []
    for username in list(room_users[room_name]):
        user_obj = User.query.filter_by(username=username).first()
        if user_obj and user_obj.username != 'SYSTEM':
            online_users_with_status.append({
                'username': username,
                'is_mod': user_obj.is_mod
            })
    
    print(f"📋 Sending {len(online_users_with_status)} online users to socket {sid}")
    
    # Send only to the requesting client
    emit('online_users', online_users_with_status, room=sid)

@socketio.on('join_private')
def on_join_private(data):
    """Handle joining a private chat room"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)
    
    if not user_data:
        return
    
    user1 = user_data['username']
    user2 = data.get('with')
    room = get_private_room_name(user1, user2)
    
    join_room(room, sid=sid)
    print(f"🔒 {user1} joined private room with {user2}")

@socketio.on('send_private_message')
def on_send_private_message(data):
    """Handle sending a private message"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)
    
    if not user_data:
        return
    
    from_user = user_data['username']  # Use the username from socket session
    to_user = data.get('to')
    content = data.get('content', '').strip()
    
    if not content or not to_user:
        return
    
    # Get users from database
    sender = User.query.filter_by(username=from_user).first()
    receiver = User.query.filter_by(username=to_user).first()
    
    if not sender or not receiver:
        return
    
    # Create private message
    pm = PrivateMessage(
        sender_id=sender.id,
        receiver_id=receiver.id,
        content=content,
        timestamp=datetime.utcnow()
    )
    db.session.add(pm)
    db.session.commit()
    
    # Broadcast to private room
    room = get_private_room_name(from_user, to_user)
    payload = {
        'id': pm.id,
        'from': from_user,
        'to': to_user,
        'content': content,
        'timestamp': pm.timestamp.isoformat(),
        'is_mod': sender.is_mod
    }
    
    emit('receive_private_message', payload, room=room)
    print(f"🔒 Private message sent from {from_user} to {to_user}")

# Legacy handlers for compatibility
@socketio.on('join')
def on_join(data):
    """Legacy join handler - redirects to user_connected"""
    print("⚠️ Legacy 'join' event used, redirecting to 'user_connected'")
    on_user_connected(data)