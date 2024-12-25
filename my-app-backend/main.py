import flask
import sqlite3
import logging
from flask_cors import CORS
import time
import queue

app = flask.Flask(__name__)
CORS(app)
logger = logging.getLogger("my-app-backend")
state = {}

QUEUE_SIZE = 100
take_image_queue = queue.Queue(QUEUE_SIZE)
analyze_image_queue = queue.Queue(QUEUE_SIZE)

def init_state():
    global state
    initial_grid = [[0 for _ in range(60)] for _ in range(20)]
    initial_grid[10][30] = 1
    state["grid"] = initial_grid
    state["cursor"] = [10, 30]
    return state

@app.route('/')
def index():
    return "Hello, World!"

@app.route('/state', methods=['GET'])
def get_state():
    global state
    if not take_image_queue.empty() or not analyze_image_queue.empty():
        return {"message": "Process in progress"}, 429
    logger.info(f"Getting state: {state}")
    return state

# @app.route('/state', methods=['POST'])
# def set_state():
#     global state
#     global lock
#     lo
#     print("request.json", flask.request.json)
#     state = flask.request.json
#     logger.info(f"Setting state: {state}")
#     return state

@app.route('/reset', methods=['POST'])
def reset():
    global state
    # check if any task is in progress
    if not take_image_queue.empty() or not analyze_image_queue.empty():
        return {"message": "Process in progress"}, 429
    init_state()
    return state

@app.route('/take_image', methods=['POST'])
def take_image():
    global state
    try:
        take_image_queue.put("take_image", block=False)
    except queue.Full:
        return {"message": "Process in progress"}, 429
    data = flask.request.json
    cursor = data["cursor"]
    x = cursor[0]
    y = cursor[1]
    time.sleep(3)
    state["grid"][x][y] = 2
    state["cursor"] = cursor
    take_image_queue.get()
    return state

@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    global state
    try:
        analyze_image_queue.put("analyze_image", block=False)
    except queue.Full:
        return {"message": "Process in progress"}, 429
    data = flask.request.json
    cursor = data["cursor"]
    x = cursor[0]
    y = cursor[1]
    time.sleep(2)
    state["grid"][x][y] = 3
    state["cursor"] = cursor
    analyze_image_queue.get()
    return state

if __name__ == '__main__':
    init_state()
    app.run(debug=True, host='0.0.0.0', port=9999, threaded=True)

