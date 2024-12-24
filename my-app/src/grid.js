import { useState, useEffect, useRef } from 'react';

const GRID_WIDTH = 600
const GRID_HEIGHT = 200

const BOX_SIZE = 10
const STEP_SIZE = 10

// defining the grid state
// for now fixing the grid size to 60 X 20
// for each box in the grid, we can have a state 0-4
// 0: empty
// 1: black box
// 2: green box 
// 3: red box

const IDLE_THRESHOLD = 1000;

const commitGridStateToBackend = (gridState) => {
    try{
        fetch('http://localhost:8080/state', {
            method: 'POST',
            body: JSON.stringify(gridState),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }catch(error){
        console.error('Error committing grid state to backend', error);
    }
}

const Grid = () => {

    const [messages, setMessages] = useState([]);
    const [cursor, setCursor] = useState([10,30]);
    const cursorRef = useRef(cursor);
    const [timer, setTimer] = useState(null);

    const [gridPrev, setGridPrev] = useState({
        grid: Array.from({length: 20}, () => Array(60).fill(-1)),
    });

    function debounce(func, timeout = 300){
        return (...args) => {
          clearTimeout(timer);
          setTimer(setTimeout(() => { func.apply(this, args); }, timeout));
        };
      }
    const handleKeyDown = (event) => {
        const currentCursor = cursorRef.current;
        if (event.key === 'ArrowUp') {
            if(currentCursor[0] > 0){
                setMovements((prevMovements) => ([...prevMovements, [-1,0]]));
            }
        }
        else if (event.key === 'ArrowDown') {
            if(currentCursor[0] < 20){
                setMovements((prevMovements) => ([...prevMovements, [1,0]]));
            }
        }
        else if (event.key === 'ArrowLeft') {
            if(currentCursor[1] > 0){
                setMovements((prevMovements) => ([...prevMovements, [0,-1]]));
            }
        }
        else if (event.key === 'ArrowRight') {
            if(currentCursor[1] < 60){
                setMovements((prevMovements) => ([...prevMovements, [0,1]]));
            }
        }
    }

    const [movements, setMovements] = useState([]);
    const movementsRef = useRef(movements);
    const [locked, setLocked] = useState(false);
    const [gridState, setGridState] = useState({});

    // fetch the grid state from the backend
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        // make an api call to get the grid state
        fetch('http://localhost:8080/state')
        .then(response => response.json())
        .then(data => {
            setGridState(data);
        });
    }, []);


    const handleNextMovement = () => {
        const [deltaX, deltaY] = movements[0];
        const newCursor = [cursor[0] + deltaX, cursor[1] + deltaY];
        if(newCursor[0] < 0 || newCursor[0] >= 20 || newCursor[1] < 0 || newCursor[1] >= 60){
            setMovements(movements.slice(1));
            return;
        }
        const oldCursor = cursor;
        setCursor(newCursor);

        const prevGrid = gridPrev.grid;
        const currentGrid = gridState.grid;
        
        prevGrid[newCursor[0]][newCursor[1]] = currentGrid[newCursor[0]][newCursor[1]];
        setGridPrev({grid: prevGrid});
        
        if(prevGrid[oldCursor[0]][oldCursor[1]] === -1){
            if(currentGrid[oldCursor[0]][oldCursor[1]] === 1){
                currentGrid[oldCursor[0]][oldCursor[1]] = 0;
            }
        }else{
            currentGrid[oldCursor[0]][oldCursor[1]] = prevGrid[oldCursor[0]][oldCursor[1]];
        }
        currentGrid[newCursor[0]][newCursor[1]] = 1;
        setGridState({grid: currentGrid});

        setMovements(movements.slice(1));
    }

    useEffect(() => {
        movementsRef.current = movements;
        if(movements.length === 0){
            return;
        }
        if(locked){
            return;
        }
        handleNextMovement();
    }, [movements]);

    useEffect(() => {
        if(!locked){
            if(movements.length > 0){
                handleNextMovement();
            }
        }
    }, [locked]);

    useEffect(() => {
        cursorRef.current = cursor;
        if(!cursor || ! gridState || ! gridState.grid){
            return;
        }
        if(locked){
            return;
        }
        if(gridState && gridState.grid && gridState.grid[cursor[0]][cursor[1]] === 3){
            return;
        }
        debounce(async ()=>{
            // sleep for 3 seconds
            setLocked(true);
            setMessages((prevMessages) => ([...prevMessages, "Locked: Taking a picture at " + cursor + "..."]));
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log("movements after unlocking", movements)
            setMessages((prevMessages) => ([...prevMessages, "Unlocked: taking a picture done"]));
            // how to find the latest movement state
            const currentMovements = movementsRef.current;
            const currentCursor = cursorRef.current;
            let grid = gridState.grid;
            grid[currentCursor[0]][currentCursor[1]] = 2;

            let prevGrid = gridPrev.grid;
            prevGrid[currentCursor[0]][currentCursor[1]] = 2;
            setGridPrev({grid: prevGrid});
            setGridState(prevState => ({...prevState, grid: grid}));
            commitGridStateToBackend(gridState);
            if(currentMovements.length > 0){
                console.log("not committing red since movements are not empty")
                setLocked(false)
                return;
            }
            debounce(async ()=>{
                // sleep for 2 seconds
                setLocked(true);
                setMessages((prevMessages) => ([...prevMessages, "Locked: Analyzing the picture at " + cursor + "..."]));
                await new Promise(resolve => setTimeout(resolve, 2000));
                setLocked(false);
                setMessages((prevMessages) => ([...prevMessages, "Unlocked: Analyzing done"]));
                let grid = gridState.grid;
                const currentCursor = cursorRef.current;
                grid[currentCursor[0]][currentCursor[1]] = 3;

                let prevGrid = gridPrev.grid;
                prevGrid[currentCursor[0]][currentCursor[1]] = 3;
                setGridPrev({grid: prevGrid});
                setGridState(prevState => ({...prevState, grid: grid}));
                commitGridStateToBackend(gridState);
            }, IDLE_THRESHOLD)()
        }, IDLE_THRESHOLD)()
    }, [cursor]);

    // always scroll to the bottom of the messages container
    useEffect(() => {
        const messagesContainer = document.querySelector('.messages-container');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, [messages]);

    const handleReset = () => {
        fetch('http://localhost:8080/reset', {
            method: 'POST',
        });
        // refresh the page
        window.location.reload();
    }

    return <div className="main-container">
        <div className="grid-container" style={{width: GRID_WIDTH, height: GRID_HEIGHT}}>
            {gridState && gridState.grid && gridState.grid.map((row, rowIndex) => (
                <div className="grid-row" key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                        <div className="grid-cell" key={cellIndex} style={{backgroundColor: cell === 1 ? 'black' : cell === 2 ? 'green' : cell === 3 ? 'red' : 'white'}}></div>
                    ))}
                </div>
            ))}
        </div>
            <button onClick={handleReset}>Reset</button>
        <div className="messages-container">
            {messages.map((message, index) => (
                <div className="message" key={index}>{message}</div>
            ))}
        </div>
    </div>
}

export default Grid;