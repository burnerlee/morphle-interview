import flask
import sqlite3
import logging

app = flask.Flask(__name__)
logger = logging.getLogger(__name__)
state = {}

def init_state():
    initial_grid = [[0 for _ in range(60)] for _ in range(20)]
    initial_grid[10][30] = 1
    state["grid"] = initial_grid

@app.route('/')
def index():
    return "Hello, World!"

@app.route('/state', methods=['GET'])
def get_state():
    logger.info(f"Getting state: {state}")
    return state

@app.route('/state', methods=['POST'])
def set_state():
    state = flask.request.json
    logger.info(f"Setting state: {state}")
    return state

# avoid cors issue, allow all origins
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

if __name__ == '__main__':
    init_state()
    app.run(debug=True, host='0.0.0.0', port=8080)

