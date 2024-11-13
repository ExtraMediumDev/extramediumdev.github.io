import { Vector3 } from 'three';

class UnitGrid {
    constructor() {
        this.cells = [];
        this.cellNeighbors = [];
        this.cellSize = null;
        this.filledCells = new Set();
        this.n = 0;
        this.nn = 0;
        this.nnn = 0;

        this.quickVec1 = new Vector3();
        this.quickVec2 = new Vector3();
    }

    // (Re)build the grid
    rebuild(partition) {
        if (partition <= 0 || !Number.isInteger(partition)) {
            console.error(`Invalid partition value: ${partition}`);
            return;
        }

        this.n = partition;
        this.nn = this.n * this.n;
        this.nnn = this.nn * this.n;
        this.cellSize = 2 / this.n;
        this.cellNeighbors = Array(this.nnn + 1).fill().map(() => []);

        for (let idx = 0; idx < this.nnn; idx++) {
            this.cellNeighbors[idx] = this.findNeighboringCells(...this.unhash(idx));
            if (this.cellNeighbors[idx].includes(this.nnn)) {
                this.cellNeighbors[this.nnn].push(idx);
            }
        }
    }

    resetCells() {
        this.cells = Array(this.nnn + 1).fill().map(() => []); // Initialize as an array of empty arrays
        this.filledCells.clear();
    }

    place(posArray) {
        this.resetCells();
        for (let ID = 0; ID < posArray.length / 3; ID++) {
            let [x, y, z] = posArray.slice(ID * 3, (ID + 1) * 3);
            let [i, j, k] = this.findCell(x, y, z);
            let idx = this.hash(i, j, k);
            if (this.cells[idx]) {
                this.cells[idx].push(ID);
                this.filledCells.add(idx);
            }
        }
    }

    getDistancesSq(posArray, threshold, useGrid = true) {
        if (useGrid) {
            return this.gridSearch(posArray, threshold);
        }
        return this.bruteSearch(posArray, threshold);
    }

    gridSearch(posArray, threshold) {
        this.resetCells();
        let optimalPartition = Math.floor(4 / threshold);
        if (this.n !== optimalPartition) {
            this.rebuild(optimalPartition);
        }
        this.place(posArray);

        let thresholdSq = threshold * threshold;
        let neighbors = [];
        for (let ID = 0; ID < posArray.length / 3; ID++) {
            neighbors[ID] = new Map();
        }
        for (let cell of this.filledCells) {
            let gridNeighbors = this.cellNeighbors[cell].flatMap(_ => this.cells[_] || []);
            for (let ID1 of this.cells[cell]) {
                for (let ID2 of gridNeighbors.filter(_ => _ > ID1)) {
                    this.quickVec1.fromArray(posArray, ID1 * 3);
                    this.quickVec2.fromArray(posArray, ID2 * 3);
                    let distSq = this.quickVec1.addScaledVector(this.quickVec2, -1).lengthSq();
                    if (distSq < thresholdSq) {
                        neighbors[ID1].set(ID2, distSq);
                        neighbors[ID2].set(ID1, distSq);
                    }
                }
            }
        }
        return neighbors;
    }

    bruteSearch(posArray, threshold) {
        let thresholdSq = threshold * threshold;
        let neighbors = [];
        for (let ID1 = 0; ID1 < posArray.length / 3; ID1++) {
            neighbors[ID1] = new Map();
            for (let ID2 = 0; ID2 < posArray.length / 3; ID2++) {
                if (ID1 !== ID2) {
                    this.quickVec1.fromArray(posArray, ID1 * 3);
                    this.quickVec2.fromArray(posArray, ID2 * 3);
                    let distSq = this.quickVec1.addScaledVector(this.quickVec2, -1).lengthSq();
                    if (distSq < thresholdSq) {
                        neighbors[ID1].set(ID2, distSq);
                    }
                }
            }
        }
        return neighbors;
    }

    findNear(pos, posArray, threshold){
        let thresholdSq = threshold*threshold;
        let near = new Map();
        let window = Math.ceil(threshold/this.cellSize);
        let [x, y, z] = [pos.x, pos.y, pos.z];
        let potentialNeighbors = []
        if (this.filledCells.size !== 0){
            let neighboringCells = this.findNeighboringCells(...this.findCell(x, y, z), window);
            potentialNeighbors = neighboringCells.flatMap(_ => this.cells[_]);
        }
        else {
            potentialNeighbors = [...Array(posArray.length/3).keys()];
        }
        for (let ID of potentialNeighbors){
            this.quickVec1.fromArray(posArray, ID*3);
            let distSq = this.quickVec1.addScaledVector(pos, -1).lengthSq();
            if (distSq < thresholdSq){
                near.set(ID, distSq);
            }
        }
        return near;
    }
    compare(posArray, threshold){
        const eqSet = (xs, ys) =>
            xs.size === ys.size &&
            [...xs].every((x) => ys.has(x));

        function toPairs(neighbors){
            let set = new Set();
            for (let ID1 = 0; ID1 < posArray.length/3; ID1++){
                let thisNeighbors = neighbors[ID1].keys();
                for (let ID2 of thisNeighbors){
                    set.add(`${ID1}-${ID2}`);
                }
            }
            return set;
        }
        let bruteNeighbors = this.getSqDistances(posArray, threshold, false);
        let gridNeighbors = this.getSqDistances(posArray, threshold, true);
        let bruteSet = toPairs(bruteNeighbors);
        let gridSet = toPairs(gridNeighbors);
        if (!eqSet(bruteSet, gridSet)){
            console.log("Do not match");
            console.log(bruteSet);
            console.log(gridSet);
        }
    }

    findCell(x, y, z) {
        if (this.cellSize === null || this.cellSize === 0) {
            return 0,0,0;
        }
        return [
            Math.floor((x + 1) / this.cellSize),
            Math.floor((y + 1) / this.cellSize),
            Math.floor((z + 1) / this.cellSize)
        ];
    }

    hash(i, j, k) {
        if (i < 0 || i >= this.n ||
            j < 0 || j >= this.n ||
            k < 0 || k >= this.n) {
            return -1; 
        }
        return i + j * this.n + k * this.nn;
    }

    unhash(idx) {
        return [
            idx % this.n,
            Math.floor(idx / this.n) % this.n,
            Math.floor(idx / this.nn)
        ];
    }

    findNeighboringCells(i, j, k, window = 1) {
        let neighbors = [];
        for (let l = i - window; l <= i + window; l++) {
            for (let m = j - window; m <= j + window; m++) {
                for (let n = k - window; n <= k + window; n++) {
                    const hashedIndex = this.hash(l, m, n);
                    if (typeof hashedIndex === 'number' && hashedIndex >= 0 && hashedIndex < this.cellNeighbors.length) {
                        neighbors.push(hashedIndex);
                    }
                }
            }
        }
        neighbors = [...new Set(neighbors)];
        return neighbors;
    }
}

export { UnitGrid };
