from app import create_app, db
from app.models import Message
from sqlalchemy import text

def migrate_to_rooms():
    """Migrate existing database to support multiple chat rooms"""
    print("🚀 Starting migration to multiple chat rooms...")
    
    app = create_app()
    
    with app.app_context():
        try:
            # Check if room_name column exists using new SQLAlchemy syntax
            result = db.session.execute(text("PRAGMA table_info(message)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'room_name' not in columns:
                # Add the room_name column using new syntax
                db.session.execute(text("ALTER TABLE message ADD COLUMN room_name VARCHAR(50) DEFAULT 'Chat Room 1'"))
                db.session.commit()
                print("✅ Added room_name column to message table")
            else:
                print("⚠️ room_name column already exists")
            
            # Update all existing messages to be in "Chat Room 1"
            messages_updated = 0
            existing_messages = Message.query.all()
            
            for msg in existing_messages:
                if not hasattr(msg, 'room_name') or not msg.room_name or msg.room_name == '':
                    msg.room_name = 'Chat Room 1'
                    messages_updated += 1
            
            if messages_updated > 0:
                db.session.commit()
                print(f"✅ Updated {messages_updated} existing messages to 'Chat Room 1'")
            else:
                print("ℹ️ No messages needed updating")
            
            # Verify migration
            total_messages = Message.query.count()
            room1_messages = Message.query.filter_by(room_name='Chat Room 1').count()
            
            print(f"📊 Migration Summary:")
            print(f"   Total messages: {total_messages}")
            print(f"   Messages in Chat Room 1: {room1_messages}")
            
            print("🎉 Migration completed successfully!")
            print("🏠 Your chat app now supports 5 different chat rooms!")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            print("💡 Error details:")
            print(f"   - Make sure your app is not running")
            print(f"   - Check if database file exists and is accessible")
            db.session.rollback()
            return False
    
    return True

if __name__ == '__main__':
    print("=" * 60)
    print("🏗️  CHAT ROOMS DATABASE MIGRATION")
    print("=" * 60)
    print()
    
    success = migrate_to_rooms()
    
    print()
    if success:
        print("🎊 MIGRATION SUCCESSFUL!")
        print("📝 Next steps:")
        print("   1. Replace your files with the new versions")
        print("   2. Start your app: python app.py")
        print("   3. Login and enjoy 5 different chat rooms!")
    else:
        print("💥 MIGRATION FAILED!")
        print("🛠️ Please check the error messages above")
    
    print("=" * 60)