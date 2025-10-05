from datetime import datetime
from app import db

class User(db.Model):
    """Represents a user in the chat application."""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_mod = db.Column(db.Boolean, default=False) # Moderator flag added

    # Relationship for public messages
    messages = db.relationship('Message', backref='user', lazy=True)

    # Relationship for private messages sent
    private_messages_sent = db.relationship(
        'PrivateMessage',
        foreign_keys='PrivateMessage.sender_id',
        backref='sender',
        lazy=True
    )

    # Relationship for private messages received
    private_messages_received = db.relationship(
        'PrivateMessage',
        foreign_keys='PrivateMessage.receiver_id',
        backref='receiver',
        lazy=True
    )

    def __repr__(self):
        return f'<User {self.username}>'

    def get_friends(self):
        """Get all accepted friends for this user."""
        # Friendships where this user is the sender
        friends_as_sender = db.session.query(User).join(
            Friendship,
            (Friendship.receiver_id == User.id)
        ).filter(
            Friendship.sender_id == self.id,
            Friendship.status == 'accepted'
        ).all()

        # Friendships where this user is the receiver
        friends_as_receiver = db.session.query(User).join(
            Friendship,
            (Friendship.sender_id == User.id)
        ).filter(
            Friendship.receiver_id == self.id,
            Friendship.status == 'accepted'
        ).all()

        # Combine and dedupe
        return list({f.id: f for f in (friends_as_sender + friends_as_receiver)}.values())

    def get_friend_requests(self):
        """Get pending friend requests sent to this user."""
        return Friendship.query.filter_by(
            receiver_id=self.id,
            status='pending'
        ).all()

    def is_friend_with(self, other_user):
        """Check if this user is friends with another user."""
        return Friendship.query.filter(
            ((Friendship.sender_id == self.id) & (Friendship.receiver_id == other_user.id)) |
            ((Friendship.sender_id == other_user.id) & (Friendship.receiver_id == self.id)),
            Friendship.status == 'accepted'
        ).first() is not None

class Message(db.Model):
    """Represents a public chat message."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    # NEW: Add room_name field for multiple chat rooms
    room_name = db.Column(db.String(50), nullable=False, default='Chat Room 1')

    def __repr__(self):
        return f'<Message {self.id} in {self.room_name}>'

class Friendship(db.Model):
    """Represents friend relationships between users."""
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='pending') # 'pending', 'accepted', 'rejected'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships to users
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_friend_requests')
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref='received_friend_requests')

    __table_args__ = (db.UniqueConstraint('sender_id', 'receiver_id'),)

    def __repr__(self):
        return f'<Friendship {self.sender_id} -> {self.receiver_id} ({self.status})>'

class PrivateMessage(db.Model):
    """Represents a private message between two users."""
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    read = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f'<PrivateMessage {self.sender_id} -> {self.receiver_id}>'

class ChatRoom(db.Model):
    """Represents a private group chat room."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_private = db.Column(db.Boolean, default=True)

    creator = db.relationship('User', backref='created_rooms')

    def __repr__(self):
        return f'<ChatRoom {self.name}>'

room_members = db.Table(
    'room_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('room_id', db.Integer, db.ForeignKey('chat_room.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow)
)

class RoomMessage(db.Model):
    """Represents a message in a private group chat room."""
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_room.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    room = db.relationship('ChatRoom', backref='room_messages')
    user = db.relationship('User', backref='room_messages')

    def __repr__(self):
        return f'<RoomMessage {self.id}>'

# Moderator Ban model
class Ban(db.Model):
    """Permanent ban from public chat."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    banned_at = db.Column(db.DateTime, default=datetime.utcnow)

# Moderator Kick model
class Kick(db.Model):
    """Temporary 12-hour kick from public chat."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    kicked_at = db.Column(db.DateTime, default=datetime.utcnow)

# Add many-to-many relationship between User and ChatRoom
User.joined_rooms = db.relationship(
    'ChatRoom',
    secondary=room_members,
    backref='members'
)