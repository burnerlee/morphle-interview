import flask
import sqlite3
import logging
from flask_cors import CORS
import time
import queue
import threading
from flask_socketio import SocketIO, emit

import eventlet
eventlet.monkey_patch()

app = flask.Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*") 

CORS(app)
logger = logging.getLogger("my-app-backend")
global_grid = []
soft_cursor_x = 10
soft_cursor_y = 30
global_cursor = [soft_cursor_x, soft_cursor_y]
is_resetting = False
QUEUE_SIZE = 1000

keylog_queue = queue.Queue(QUEUE_SIZE)

DEBOUNCE_THRESHOLD = 0.3
TIME_TAKE_IMAGE = 3
TIME_ANALYZE_IMAGE = 2

def init_state():
    global global_grid
    global global_cursor
    global soft_cursor_x
    global soft_cursor_y
    global keylog_queue
    global is_resetting

    is_resetting = True
    time.sleep(1)
    while not keylog_queue.empty():
        keylog_queue.get()

    initial_grid = [[0 for _ in range(60)] for _ in range(20)]
    global_grid = initial_grid
    soft_cursor_x = 10
    soft_cursor_y = 30
    global_cursor = [soft_cursor_x, soft_cursor_y]
    is_resetting = False

@socketio.on("reset")
def handle_reset():
    emit("message", {"message": "Restting the machine"})
    init_state()
    emit("message", {"message": "Machine reset complete"})
    emit("message", {"type": "reset_ok"})

@socketio.on("connect")
def handle_connect():
    print("Client connected")
    emit("state", {"grid": global_grid, "cursor": global_cursor})  # Send initial message to client

@socketio.on("disconnect")
def handle_disconnect():
    print("websocket client disconnected")

@socketio.on("message")
def handle_message(message):
    print(f"Received message from client: {message}")

@socketio.on("keylog")
def handle_keylog(data):
    global keylog_queue
    global soft_cursor_x
    global soft_cursor_y

    keylog = {
        "key": data["key"],
        "timestamp": data["timestamp"]
    }
    if keylog["key"] == "up":
        if soft_cursor_x > 0:
            soft_cursor_x -= 1
        else:
            emit("message", {"type": "error", "message": "cursor is at the top of the grid"})
            return
    elif keylog["key"] == "down":
        if soft_cursor_x < 19:
            soft_cursor_x += 1
        else:
            emit("message", {"type": "error", "message": "cursor is at the bottom of the grid"})
            return
    elif keylog["key"] == "left":
        if soft_cursor_y > 0:
            soft_cursor_y -= 1
        else:
            emit("message", {"type": "error", "message": "cursor is at the left of the grid"})
            return
    elif keylog["key"] == "right":
        if soft_cursor_y < 59:
            soft_cursor_y += 1
        else:
            emit("message", {"type": "error", "message": "cursor is at the right of the grid"})
            return

    try:
        keylog_queue.put(keylog, block=False)
    except queue.Full:
        emit("message", {"type": "error", "message": "queue is full"})
        return

    emit("message", {"type": "message", "message": "keylog added"})


def move_cursor(keylog):
    global global_cursor
    global socketio
    if keylog["key"] == "up":
        global_cursor[0] -= 1
    elif keylog["key"] == "down":
        global_cursor[0] += 1
    elif keylog["key"] == "left":
        global_cursor[1] -= 1
    elif keylog["key"] == "right":
        global_cursor[1] += 1

    print(f"moved cursor to {global_cursor}")
    socketio.emit("message", {"type": "cursor", "cursor": global_cursor})
    socketio.emit("message", {"type": "message", "message": f"moved cursor to {global_cursor}"})
    return True

def is_cursor_valid(cursor, direction):
    if direction == "up":
        return cursor[0] > 0
    elif direction == "down":
        return cursor[0] < 19
    elif direction == "left":
        return cursor[1] > 0
    elif direction == "right":
        return cursor[1] < 59

def call_operations_take_image(cursor):
    global global_grid
    global socketio
    global is_resetting
    x = cursor[0]
    y = cursor[1]
    
    if global_grid[x][y] == 2:
        return


    print(f"taking image at {global_cursor}")
    socketio.emit("message", {"type": "message", "message": f"taking image at {global_cursor}"})
    time_remaining = TIME_TAKE_IMAGE
    while time_remaining > 0:
        if is_resetting:
            return
        time.sleep(0.1)
        time_remaining -= 0.1
    global_grid[x][y] = 1
    print(f"took image at {global_cursor}")
    socketio.emit("message", {"type": "message", "message": f"took image at {global_cursor}"})
    socketio.emit("message", {"type": "state", "state": {"grid": global_grid, "cursor": global_cursor} })
    if keylog_queue.empty():
        call_operations_analyze_image(cursor)


def call_operations_analyze_image(cursor):
    global global_grid
    global socketio
    global is_resetting
    x = cursor[0]
    y = cursor[1]
    
    if global_grid[x][y] == 2:
        return
    
    print(f"analyzing image at {global_cursor}")
    socketio.emit("message", {"type": "message", "message": f"analyzing image at {global_cursor}"})
    time_remaining = TIME_ANALYZE_IMAGE
    while time_remaining > 0:
        if is_resetting:
            return
        time.sleep(0.1)
        time_remaining -= 0.1
    global_grid[x][y] = 2
    print(f"analyzed image at {global_cursor}")
    socketio.emit("message", {"type": "message", "message": f"analyzed image at {global_cursor}"})
    socketio.emit("message", {"type": "state", "state": {"grid": global_grid, "cursor": global_cursor}})

def process_keylog():
    global keylog_queue
    prev_keylog = None
    while True:
        if prev_keylog is None:
            keylog = keylog_queue.get()
        else:
            keylog = prev_keylog
            
        if not is_cursor_valid(global_cursor, keylog["key"]):
            continue
        # move the cursor
        move_cursor(keylog)

        try:
            next_keylog = keylog_queue.get(timeout=DEBOUNCE_THRESHOLD)
        except queue.Empty:
            # there is no next keylog in the queue
            call_operations_take_image(cursor=global_cursor)
            prev_keylog = None
            continue

        # next_keylog is found
        # find the time difference between the two keylogs
        # if the time difference is greater than DEBOUNCE_THRESHOLD, then process the keylog
        # if the time difference is less than DEBOUNCE_THRESHOLD, then skip the keylog
        keylog_time = keylog["timestamp"]
        next_keylog_time = next_keylog["timestamp"]
        time_diff = next_keylog_time - keylog_time
        if time_diff > (DEBOUNCE_THRESHOLD*1000):
            # process the keylog
            call_operations_take_image(cursor=global_cursor)
            prev_keylog = next_keylog
            continue
        else:
            # skip the keylog
            print("skipping perfoming operations since the time difference is less than DEBOUNCE_THRESHOLD")
            prev_keylog = next_keylog
            continue

@app.route('/')
def index():
    return "Hello, World!"

@app.route('/state', methods=['GET'])
def get_state():
    global global_grid
    global global_cursor
    return {"grid": global_grid, "cursor": global_cursor}


if __name__ == '__main__':
    init_state()
    # star the process_keylog in a separate thread
    socketio.start_background_task(process_keylog)
    socketio.run(app, debug=True, host="0.0.0.0", port=9999)
