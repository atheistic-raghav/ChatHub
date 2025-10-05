from flask import Blueprint, request, session, jsonify
from flask_cors import cross_origin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, socketio
from app.models import User, Message, Friendship, PrivateMessage, Ban, Kick
from datetime import datetime, timedelta, timezone
from flask_socketio import emit, join_room, leave_room
import logging

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
    """Remove messages older than 24 hours"""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    Message.query.filter(Message.timestamp < cutoff).delete()
    db.session.commit()

def is_kicked(user):
    """Check if user is currently kicked"""
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
    else:
        return  # Invalid action

    try:
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

    except Exception as e:
        logging.error(f"Error creating system message: {e}")
        db.session.rollback()

def broadcast_online_users(room_name):
    """Broadcast online users list to a specific room"""
    try:
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

        logging.debug(f"Broadcasting {len(online_users_with_status)} online users to room '{room_name}': {[u['username'] for u in online_users_with_status]}")

        socketio.emit('online_users', online_users_with_status, room=room_name)

    except Exception as e:
        logging.error(f"Error broadcasting online users: {e}")

# ============================================================================
# API ROUTES FOR REACT FRONTEND - FIXED ROUTES
# ============================================================================

@main.route('/api/health')
@cross_origin()
def api_health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'socketio_active': len(sid_to_user) > 0,
        'active_rooms': len(room_users),
        'connected_users': len(sid_to_user)
    }), 200

@main.route('/api/auth/login', methods=['POST'])
@cross_origin()
def api_login():
    """API endpoint for React login"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400

        username = data.get('username', '').strip()
        password = data.get('password', '')

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
        logging.error(f"Login error: {e}")
        return jsonify({'message': 'Server error during login'}), 500

@main.route('/api/auth/register', methods=['POST'])
@cross_origin()
def api_register():
    """API endpoint for React registration"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400

        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'message': 'Username and password are required'}), 400

        if len(username) < 3 or len(username) > 20:
            return jsonify({'message': 'Username must be between 3 and 20 characters'}), 400

        if len(password) < 6:
            return jsonify({'message': 'Password must be at least 6 characters'}), 400

        if username.upper() == 'SYSTEM':
            return jsonify({'message': 'Username "SYSTEM" is reserved'}), 400

        # Check for existing user (case insensitive)
        existing_user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
        if existing_user:
            return jsonify({'message': 'Username already taken'}), 409

        hashed_password = generate_password_hash(password)
        user = User(username=username, password_hash=hashed_password)
        db.session.add(user)
        db.session.commit()

        return jsonify({'message': 'Account created successfully'}), 201
    except Exception as e:
        logging.error(f"Register error: {e}")
        db.session.rollback()
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
        logging.error(f"Get current user error: {e}")
        return jsonify({'error': 'Server error'}), 500

@main.route('/api/auth/logout', methods=['POST'])
@cross_origin()
def api_logout():
    """Log out current user by clearing session"""
    session.pop('user', None)
    return jsonify({'message': 'Logged out successfully'})

@main.route('/api/mod/kick', methods=['POST'])
@cross_origin()
def api_kick_user():
    """Kick a user for 12 hours (moderators only)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        data = request.get_json() or {}
        target_username = (data.get('username') or '').strip()

        if not target_username:
            return jsonify({'error': 'Username is required'}), 400

        mod_user = User.query.filter_by(username=session['user']).first()
        if not mod_user or not mod_user.is_mod:
            return jsonify({'error': 'Unauthorized - Moderator access required'}), 403

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
    except Exception as e:
        logging.error(f"Kick user error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Server error during kick operation'}), 500

@main.route('/api/mod/ban', methods=['POST'])
@cross_origin()
def api_ban_user():
    """Ban a user permanently (moderators only)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        data = request.get_json() or {}
        target_username = (data.get('username') or '').strip()

        if not target_username:
            return jsonify({'error': 'Username is required'}), 400

        mod_user = User.query.filter_by(username=session['user']).first()
        if not mod_user or not mod_user.is_mod:
            return jsonify({'error': 'Unauthorized - Moderator access required'}), 403

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
    except Exception as e:
        logging.error(f"Ban user error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Server error during ban operation'}), 500

@main.route('/api/rooms')
@cross_origin()
def api_get_rooms():
    """API endpoint to get available chat rooms"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    return jsonify({
        'rooms': CHAT_ROOMS,
        'user': session['user'],
        'total_rooms': len(CHAT_ROOMS)
    })

# FIXED: Added missing route parameter
@main.route('/api/chat/messages/<room_name>')
@cross_origin()
def api_get_messages(room_name):
    """API endpoint to get messages for a specific room"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if room_name not in CHAT_ROOMS:
        return jsonify({'error': 'Invalid room'}), 404

    try:
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
    except Exception as e:
        logging.error(f"Get messages error: {e}")
        return jsonify({'error': 'Server error retrieving messages'}), 500

# FIXED: Added missing route parameter
@main.route('/api/chat/messages/<room_name>', methods=['POST'])
@cross_origin()
def api_send_message(room_name):
    """API endpoint to send a message to a specific room (REST fallback)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if room_name not in CHAT_ROOMS:
        return jsonify({'error': 'Invalid room'}), 404

    try:
        data = request.get_json() or {}
        content = (data.get('content') or '').strip()

        if not content:
            return jsonify({'error': 'Content is required'}), 400

        if len(content) > 1000:
            return jsonify({'error': 'Message too long (max 1000 characters)'}), 400

        user = User.query.filter_by(username=session['user']).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if Ban.query.filter_by(user_id=user.id).first():
            return jsonify({'error': 'User is banned from sending messages'}), 403

        if is_kicked(user):
            return jsonify({'error': 'User is temporarily kicked'}), 403

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

        logging.debug(f"REST fallback: Broadcasting message to room '{room_name}': {content[:50]}...")
        socketio.emit('receive_message', payload, room=room_name)

        return jsonify(payload), 201
    except Exception as e:
        logging.error(f"Send message error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Server error sending message'}), 500

@main.route('/api/friends')
@cross_origin()
def api_get_friends():
    """API endpoint to get friends and friend requests"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        current_user = User.query.filter_by(username=session['user']).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

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
    except Exception as e:
        logging.error(f"Get friends error: {e}")
        return jsonify({'error': 'Server error retrieving friends'}), 500

@main.route('/api/users/search', methods=['POST'])
@cross_origin()
def api_search_users():
    """API endpoint for user search"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        data = request.get_json() or {}
        term = data.get('search_term', '').strip()
        current_user = User.query.filter_by(username=session['user']).first()

        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404

        if not term:
            return jsonify({'users': []})

        if len(term) < 2:
            return jsonify({'error': 'Search term must be at least 2 characters'}), 400

        users = User.query.filter(
            User.username.ilike(f'%{term}%'),
            User.id != current_user.id,
            User.username != 'SYSTEM'
        ).limit(10).all()  # Limit results to prevent large responses

        return jsonify({
            'users': [{
                'id': user.id,
                'username': user.username,
                'is_mod': user.is_mod,
                'created_at': user.created_at.isoformat()
            } for user in users],
            'search_term': term,
            'result_count': len(users)
        })
    except Exception as e:
        logging.error(f"Search users error: {e}")
        return jsonify({'error': 'Server error during search'}), 500

# FIXED: Added missing route parameter
@main.route('/api/friends/request/<int:user_id>', methods=['POST'])
@cross_origin()
def api_send_friend_request(user_id):
    """API endpoint to send friend request"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        current_user = User.query.filter_by(username=session['user']).first()
        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404

        target_user = User.query.get(user_id)
        if not target_user:
            return jsonify({'error': 'Target user not found'}), 404

        if current_user.id == target_user.id:
            return jsonify({'error': 'Cannot send friend request to yourself'}), 400

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
    except Exception as e:
        logging.error(f"Send friend request error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Server error sending friend request'}), 500

# FIXED: Added missing route parameter
@main.route('/api/friends/accept/<int:request_id>', methods=['POST'])
@cross_origin()
def api_accept_friend_request(request_id):
    """API endpoint to accept friend request"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        current_user = User.query.filter_by(username=session['user']).first()
        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404

        friend_request = Friendship.query.get(request_id)
        if not friend_request:
            return jsonify({'error': 'Friend request not found'}), 404

        if friend_request.receiver_id != current_user.id:
            return jsonify({'error': 'Unauthorized - Not your friend request'}), 403

        friend_request.status = 'accepted'
        friend_request.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': f'You are now friends with {friend_request.sender.username}'})
    except Exception as e:
        logging.error(f"Accept friend request error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Server error accepting friend request'}), 500

# FIXED: Added missing route parameter
@main.route('/api/friends/reject/<int:request_id>', methods=['POST'])
@cross_origin()
def api_reject_friend_request(request_id):
    """API endpoint to reject friend request"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        current_user = User.query.filter_by(username=session['user']).first()
        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404

        friend_request = Friendship.query.get(request_id)
        if not friend_request:
            return jsonify({'error': 'Friend request not found'}), 404

        if friend_request.receiver_id != current_user.id:
            return jsonify({'error': 'Unauthorized - Not your friend request'}), 403

        friend_request.status = 'rejected'
        friend_request.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': 'Friend request rejected'})
    except Exception as e:
        logging.error(f"Reject friend request error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Server error rejecting friend request'}), 500

# FIXED: Added missing route parameter
@main.route('/api/friends/messages/<int:friend_id>')
@cross_origin()
def api_get_private_messages(friend_id):
    """API endpoint to get private messages with a friend"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        current_user = User.query.filter_by(username=session['user']).first()
        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404

        friend = User.query.get(friend_id)
        if not friend:
            return jsonify({'error': 'Friend not found'}), 404

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
    except Exception as e:
        logging.error(f"Get private messages error: {e}")
        return jsonify({'error': 'Server error retrieving private messages'}), 500

# FIXED: Added missing route parameter
@main.route('/api/friends/messages/<int:friend_id>', methods=['POST'])
@cross_origin()
def api_send_private_message(friend_id):
    """API endpoint to send a private message (REST fallback)"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        current_user = User.query.filter_by(username=session['user']).first()
        if not current_user:
            return jsonify({'error': 'Current user not found'}), 404

        friend = User.query.get(friend_id)
        if not friend:
            return jsonify({'error': 'Friend not found'}), 404

        if not current_user.is_friend_with(friend):
            return jsonify({'error': 'You can only chat with friends'}), 403

        data = request.get_json() or {}
        content = (data.get('content') or '').strip()

        if not content:
            return jsonify({'error': 'Content is required'}), 400

        if len(content) > 1000:
            return jsonify({'error': 'Message too long (max 1000 characters)'}), 400

        pm = PrivateMessage(
            sender_id=current_user.id, 
            receiver_id=friend.id, 
            content=content, 
            timestamp=datetime.utcnow()
        )
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
    except Exception as e:
        logging.error(f"Send private message error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Server error sending private message'}), 500

# ============================================================================
# SOCKETIO HANDLERS - FIXED VERSION WITH COMPREHENSIVE ERROR HANDLING
# ============================================================================

@socketio.on('connect')
def on_connect():
    """Handle client connection - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid
    client_ip = flask_request.environ.get('REMOTE_ADDR', 'unknown')
    logging.info(f"Socket {sid} connected from {client_ip}")

    # Send immediate connection confirmation to prevent timeout
    emit('connection_status', {
        'status': 'connected', 
        'sid': sid,
        'server_time': datetime.utcnow().isoformat()
    })

@socketio.on('disconnect')
def on_disconnect():
    """Handle client disconnection - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.pop(sid, None)

    if user_data:
        username = user_data['username']
        logging.info(f"Socket {sid} disconnected - User: {username}")

        # Clean up user mappings
        if username in user_to_sid and user_to_sid[username] == sid:
            del user_to_sid[username]

        # Remove from all rooms and broadcast updates
        for room_name in CHAT_ROOMS:
            if room_name in room_users and username in room_users[room_name]:
                room_users[room_name].discard(username)
                logging.debug(f"Removed {username} from room {room_name}")

                # Broadcast updated online users
                broadcast_online_users(room_name)

                # Notify room that user left
                emit('user_left', {'username': username}, room=room_name)
    else:
        logging.info(f"Socket {sid} disconnected - No user data found")

@socketio.on('user_connected')
def on_user_connected(data):
    """Handle user connecting to a specific room - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid

    try:
        # Validate input data with better error handling
        if not isinstance(data, dict):
            logging.warning(f"Invalid data format from {sid}: {data}")
            emit('error', {'message': 'Invalid data format', 'code': 'INVALID_DATA'})
            return

        username = data.get('username', '').strip()
        room_name = data.get('room_name', 'Chat Room 1').strip()

        # Enhanced validation
        if not username:
            logging.warning(f"Empty username from {sid}")
            emit('error', {'message': 'Username is required', 'code': 'EMPTY_USERNAME'})
            return

        if room_name not in CHAT_ROOMS:
            logging.warning(f"Invalid room '{room_name}' from {sid}")
            emit('error', {'message': 'Invalid room', 'code': 'INVALID_ROOM'})
            return


        # Verify user exists and check permissions
        user = User.query.filter_by(username=username).first()
        if not user:
            logging.warning(f"User {username} not found in database")
            emit('error', {'message': 'User not found', 'code': 'USER_NOT_FOUND'})
            return

        # Check if user is banned or kicked
        if Ban.query.filter_by(user_id=user.id).first():
            logging.warning(f"Banned user {username} attempted to connect")
            emit('error', {'message': 'User is banned', 'code': 'USER_BANNED'})
            return

        if is_kicked(user):
            logging.warning(f"Kicked user {username} attempted to connect")
            emit('error', {'message': 'User is temporarily kicked', 'code': 'USER_KICKED'})
            return

        logging.info(f"User {username} connecting to room {room_name} (Socket: {sid})")

        # Store user data for this socket
        sid_to_user[sid] = {
            'username': username,
            'user_id': user.id,
            'is_mod': user.is_mod,
            'current_room': room_name,
            'connected_at': datetime.utcnow(),
            'last_activity': datetime.utcnow()
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

        logging.info(f"{username} joined room {room_name}. Room now has: {list(room_users[room_name])}")

        # Send success confirmation to the connecting user
        emit('connection_confirmed', {
            'room_name': room_name,
            'username': username,
            'is_mod': user.is_mod,
            'room_users_count': len(room_users[room_name]),
            'server_time': datetime.utcnow().isoformat()
        })

        # Broadcast updated online users list
        broadcast_online_users(room_name)

        # Notify room that user joined
        emit('user_joined', {
            'username': username, 
            'is_mod': user.is_mod,
            'join_time': datetime.utcnow().isoformat()
        }, room=room_name)

    except Exception as e:
        logging.error(f"Error in user_connected: {e}")
        emit('error', {'message': 'Server error during connection', 'code': 'SERVER_ERROR'})

@socketio.on('send_message')
def handle_send_message(data):
    """Handle sending a message to a room - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)

    if not user_data:
        logging.warning(f"No user data for socket {sid}")
        emit('error', {'message': 'User not authenticated', 'code': 'NOT_AUTHENTICATED'})
        return

    try:
        # Update last activity
        user_data['last_activity'] = datetime.utcnow()

        # Validate input data
        if not isinstance(data, dict):
            logging.warning(f"Invalid message data from {sid}: {data}")
            emit('error', {'message': 'Invalid message format', 'code': 'INVALID_FORMAT'})
            return

        username = user_data['username']
        content = data.get('content', '').strip()
        room_name = data.get('room_name', user_data.get('current_room', 'Chat Room 1')).strip()

        # Enhanced message validation
        if not content:
            emit('error', {'message': 'Message content cannot be empty', 'code': 'EMPTY_CONTENT'})
            return

        if len(content) > 1000:  # Message length limit
            emit('error', {'message': 'Message too long (max 1000 characters)', 'code': 'MESSAGE_TOO_LONG'})
            return

        if room_name not in CHAT_ROOMS:
            emit('error', {'message': 'Invalid room', 'code': 'INVALID_ROOM'})
            return

        # Get user from database and validate permissions
        user = User.query.filter_by(username=username).first()
        if not user:
            emit('error', {'message': 'User not found', 'code': 'USER_NOT_FOUND'})
            return

        if Ban.query.filter_by(user_id=user.id).first():
            emit('error', {'message': 'User is banned', 'code': 'USER_BANNED'})
            return

        if is_kicked(user):
            emit('error', {'message': 'User is temporarily kicked', 'code': 'USER_KICKED'})
            return

        logging.debug(f"{username} sending message to {room_name}: {content[:50]}...")

        # Create message in database
        msg = Message(
            user_id=user.id,
            content=content,
            timestamp=datetime.utcnow(),
            room_name=room_name
        )
        db.session.add(msg)
        db.session.commit()

        # Prepare payload
        payload = {
            'id': msg.id,
            'username': username,
            'content': content,
            'timestamp': msg.timestamp.isoformat(),
            'is_mod': user.is_mod,
            'is_system': False,
            'room_name': room_name
        }

        logging.debug(f"Broadcasting message to room {room_name}")

        # Broadcast message to room
        emit('receive_message', payload, room=room_name)

        # Send confirmation to sender
        emit('message_sent', {
            'message_id': msg.id, 
            'status': 'delivered',
            'timestamp': msg.timestamp.isoformat()
        })

    except Exception as e:
        logging.error(f"Error sending message: {e}")
        db.session.rollback()
        emit('error', {'message': 'Failed to send message', 'code': 'SEND_FAILED'})

@socketio.on('leave')
def on_leave(data):
    """Handle user leaving a room - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)

    if not user_data:
        logging.warning(f"No user data for leave request from {sid}")
        return

    try:
        # Validate input
        if not isinstance(data, dict):
            logging.warning(f"Invalid leave data from {sid}: {data}")
            emit('error', {'message': 'Invalid leave data format'})
            return

        username = data.get('username', '').strip()
        room = data.get('room', '').strip()

        # Security check - ensure user can only leave themselves
        if username != user_data['username']:
            logging.warning(f"User {user_data['username']} trying to leave as {username}")
            emit('error', {'message': 'Cannot leave as different user'})
            return

        if room not in CHAT_ROOMS:
            logging.warning(f"Invalid room for leave: {room}")
            emit('error', {'message': 'Invalid room'})
            return

        logging.info(f"{username} leaving room {room}")

        # Leave the socket room
        leave_room(room, sid=sid)

        # Remove from room tracking
        if room in room_users and username in room_users[room]:
            room_users[room].discard(username)

            logging.info(f"Removed {username} from room {room}")

            # Broadcast updated online users
            broadcast_online_users(room)

            # Notify room that user left
            emit('user_left', {
                'username': username,
                'leave_time': datetime.utcnow().isoformat()
            }, room=room)

            # Confirm to the leaving user
            emit('left_room', {
                'room': room,
                'status': 'success'
            })

    except Exception as e:
        logging.error(f"Error during room leave: {e}")
        emit('error', {'message': 'Failed to leave room'})

@socketio.on('who_is_online')
def who_is_online(data):
    """Handle request for online users in a room - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid

    try:
        # Validate input
        if not isinstance(data, dict):
            room_name = 'Chat Room 1'  # Default room
        else:
            room_name = data.get('room_name', 'Chat Room 1')

        if room_name not in CHAT_ROOMS:
            logging.warning(f"Invalid room for online users request: {room_name}")
            emit('error', {'message': 'Invalid room'})
            return

        logging.debug(f"Online users request for room {room_name} from {sid}")

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

        logging.debug(f"Sending {len(online_users_with_status)} online users to socket {sid}")

        # Send only to the requesting client
        emit('online_users', {
            'room_name': room_name,
            'users': online_users_with_status,
            'count': len(online_users_with_status),
            'timestamp': datetime.utcnow().isoformat()
        }, room=sid)

    except Exception as e:
        logging.error(f"Error getting online users: {e}")
        emit('error', {'message': 'Failed to get online users'})

@socketio.on('join_private')
def on_join_private(data):
    """Handle joining a private chat room - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)

    if not user_data:
        logging.warning(f"No user data for private join from {sid}")
        emit('error', {'message': 'User not authenticated'})
        return

    try:
        # Validate input
        if not isinstance(data, dict):
            logging.warning(f"Invalid private join data from {sid}: {data}")
            emit('error', {'message': 'Invalid data format'})
            return

        user1 = user_data['username']
        user2 = data.get('with', '').strip()

        if not user2:
            emit('error', {'message': 'Target user is required'})
            return

        if user1 == user2:
            emit('error', {'message': 'Cannot join private room with yourself'})
            return

        # Verify both users exist and are friends
        current_user = User.query.filter_by(username=user1).first()
        target_user = User.query.filter_by(username=user2).first()

        if not current_user or not target_user:
            emit('error', {'message': 'One or both users not found'})
            return

        if not current_user.is_friend_with(target_user):
            emit('error', {'message': 'You can only chat with friends'})
            return

        room = get_private_room_name(user1, user2)
        join_room(room, sid=sid)

        logging.info(f"{user1} joined private room with {user2}")

        emit('private_room_joined', {
            'room': room,
            'with': user2,
            'status': 'success'
        })

    except Exception as e:
        logging.error(f"Error joining private room: {e}")
        emit('error', {'message': 'Failed to join private room'})

@socketio.on('send_private_message')
def on_send_private_message(data):
    """Handle sending a private message - FIXED VERSION"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)

    if not user_data:
        logging.warning(f"No user data for private message from {sid}")
        emit('error', {'message': 'User not authenticated'})
        return

    try:
        # Validate input
        if not isinstance(data, dict):
            logging.warning(f"Invalid private message data from {sid}: {data}")
            emit('error', {'message': 'Invalid data format'})
            return

        from_user = user_data['username']
        to_user = data.get('to', '').strip()
        content = data.get('content', '').strip()

        # Validate message data
        if not to_user:
            emit('error', {'message': 'Recipient is required'})
            return

        if not content:
            emit('error', {'message': 'Message content cannot be empty'})
            return

        if len(content) > 1000:
            emit('error', {'message': 'Message too long (max 1000 characters)'})
            return

        if from_user == to_user:
            emit('error', {'message': 'Cannot send message to yourself'})
            return

        # Get users from database
        sender = User.query.filter_by(username=from_user).first()
        receiver = User.query.filter_by(username=to_user).first()

        if not sender or not receiver:
            emit('error', {'message': 'One or both users not found'})
            return

        # Check if users are friends
        if not sender.is_friend_with(receiver):
            emit('error', {'message': 'You can only send messages to friends'})
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

        # Prepare payload
        room = get_private_room_name(from_user, to_user)
        payload = {
            'id': pm.id,
            'from': from_user,
            'to': to_user,
            'content': content,
            'timestamp': pm.timestamp.isoformat(),
            'is_mod': sender.is_mod
        }

        # Broadcast to private room
        emit('receive_private_message', payload, room=room)

        # Send confirmation to sender
        emit('private_message_sent', {
            'message_id': pm.id,
            'to': to_user,
            'status': 'delivered'
        })

        logging.info(f"Private message sent from {from_user} to {to_user}")

    except Exception as e:
        logging.error(f"Error sending private message: {e}")
        db.session.rollback()
        emit('error', {'message': 'Failed to send private message'})

# Connection keepalive handler - CRITICAL FIX FOR TIMEOUTS
@socketio.on('ping')
def handle_ping():
    """Handle client ping for connection keepalive - PREVENTS TIMEOUTS"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid)

    if user_data:
        # Update last activity timestamp
        user_data['last_activity'] = datetime.utcnow()
        logging.debug(f"Ping received from {user_data['username']} ({sid})")
    else:
        logging.debug(f"Ping received from unknown socket {sid}")

    # Respond with pong
    emit('pong', {'timestamp': datetime.utcnow().isoformat()})

# Legacy handlers for compatibility
@socketio.on('join')
def on_join(data):
    """Legacy join handler - redirects to user_connected"""
    logging.warning("Legacy 'join' event used, redirecting to 'user_connected'")
    on_user_connected(data)

# ============================================================================
# ERROR HANDLERS - CRITICAL FOR DEBUGGING TIMEOUT ISSUES
# ============================================================================

@socketio.on_error_default
def default_error_handler(e):
    """Handle SocketIO errors - CRITICAL FOR DEBUGGING"""
    from flask import request as flask_request
    sid = flask_request.sid
    user_data = sid_to_user.get(sid, {})
    username = user_data.get('username', 'unknown')

    logging.error(f"SocketIO Error from {sid} ({username}): {str(e)}")
    logging.error(f"Error type: {type(e).__name__}")

    # Send error to client for debugging
    emit('error', {
        'message': 'An unexpected error occurred',
        'code': 'SOCKET_ERROR',
        'error_type': type(e).__name__
    })

# Connection cleanup function - PREVENTS MEMORY LEAKS
def cleanup_inactive_connections():
    """Clean up inactive socket connections to prevent memory leaks"""
    try:
        current_time = datetime.utcnow()
        inactive_sids = []

        for sid, user_data in sid_to_user.items():
            last_activity = user_data.get('last_activity', user_data.get('connected_at'))
            if last_activity and (current_time - last_activity).total_seconds() > 300:  # 5 minutes
                inactive_sids.append(sid)

        for sid in inactive_sids:
            logging.info(f"Cleaning up inactive connection: {sid}")
            user_data = sid_to_user.pop(sid, None)
            if user_data:
                username = user_data['username']
                if username in user_to_sid and user_to_sid[username] == sid:
                    del user_to_sid[username]
    except Exception as e:
        logging.error(f"Error during connection cleanup: {e}")