from app import create_app, socketio

app = create_app()

if __name__ == '__main__':
    # Bind to 127.0.0.1 for consistent IPv4 and smoother CRA proxying of websockets
    socketio.run(app, debug=True, host='127.0.0.1', port=5000)
