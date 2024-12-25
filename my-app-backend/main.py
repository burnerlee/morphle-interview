import flask
import sqlite3
import logging
from flask_cors import CORS
import time

app = flask.Flask(__name__)
CORS(app)
logger = logging.getLogger("my-app-backend")
state = {}
lock = False

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
    global lock
    while lock:
        time.sleep(1)
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
    global lock
    while lock:
        time.sleep(1)
    state = init_state()
    return "reset successful"

@app.route('/take_image', methods=['POST'])
def take_image():
    global state
    global lock
    while lock:
        time.sleep(1)
    lock = True
    data = flask.request.json
    cursor = data["cursor"]
    x = cursor[0]
    y = cursor[1]
    time.sleep(5)
    state["grid"][x][y] = 2
    state["cursor"] = cursor
    print("image taken")
    lock = False
    return state

@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    global state
    global lock
    while lock:
        time.sleep(1)
    lock = True
    data = flask.request.json
    cursor = data["cursor"]
    x = cursor[0]
    y = cursor[1]
    time.sleep(2)
    state["grid"][x][y] = 3
    state["cursor"] = cursor
    print("image analyzed")
    lock = False
    return state

if __name__ == '__main__':
    init_state()
    app.run(debug=True, host='0.0.0.0', port=9999)

