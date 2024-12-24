import { useState, useEffect } from 'react';

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

const Grid = () => {

    const [cursor, setCursor] = useState([10,30]);
    const [timer, setTimer] = useState(null);

    function debounce(func, timeout = 300){
        return (...args) => {
          clearTimeout(timer);
          setTimer(setTimeout(() => { func.apply(this, args); }, timeout));
        };
      }
    const handleKeyDown = (event) => {
        if (event.key === 'ArrowUp') {
            setMovements([...movements, [-1,0]]);
        }
        else if (event.key === 'ArrowDown') {
            setMovements([...movements, [1,0]]);
        }
        else if (event.key === 'ArrowLeft') {
            setMovements([...movements, [0,-1]]);
        }
        else if (event.key === 'ArrowRight') {
            setMovements([...movements, [0,1]]);
        }
    }

    const [movements, setMovements] = useState([]);

    const [gridState, setGridState] = useState({});

    // fetch the grid state from the backend
    useEffect(() => {
        console.log("fetching grid state");
        window.addEventListener('keydown', handleKeyDown);

        // make an api call to get the grid state
        fetch('http://localhost:8080/state')
        .then(response => response.json())
        .then(data => {
            console.log("grid state fetched", data);
            setGridState(data);
        });
    }, []);


    useEffect(() => {
        if(movements.length === 0){
            return;
        }
        const [deltaX, deltaY] = movements[0];
        const newCursor = [cursor[0] + deltaX, cursor[1] + deltaY];
        const oldCursor = cursor;
        setCursor(newCursor);
        let grid = gridState.grid;
        if(grid[oldCursor[0]][oldCursor[1]] === 1){
            grid[oldCursor[0]][oldCursor[1]] = 0;
        }
        grid[newCursor[0]][newCursor[1]] = 1;
        setGridState({grid: grid});
        setMovements(movements.slice(1));
    }, [movements]);

    useEffect(() => {
        if(!cursor || ! gridState || ! gridState.grid){
            return;
        }
        console.log("debug cursor", cursor)
        console.log("debug gridState", gridState)
        debounce(()=>{
            console.log("debounce 1")
            let grid = gridState.grid;
            grid[cursor[0]][cursor[1]] = 2;
            setGridState(prevState => ({...prevState, grid: grid}));
            debounce(()=>{
                console.log("debounce 2")
                let grid = gridState.grid;
                grid[cursor[0]][cursor[1]] = 3;
                setGridState(prevState => ({...prevState, grid: grid}));
            }, 1000)()
        }, 1000)()
    }, [cursor]);

    return <div>
        <div className="grid-container" style={{width: GRID_WIDTH, height: GRID_HEIGHT}}>
            {gridState && gridState.grid && gridState.grid.map((row, rowIndex) => (
                <div className="grid-row" key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                        <div className="grid-cell" key={cellIndex} style={{backgroundColor: cell === 1 ? 'black' : cell === 2 ? 'green' : cell === 3 ? 'red' : 'white'}}></div>
                    ))}
                </div>
            ))}
        </div>
    </div>
}

export default Grid;