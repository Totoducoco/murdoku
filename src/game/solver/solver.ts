import type {
    Board,
    Clue,
    ClueRule,
    Person,
    Position,
    PuzzleSolution
} from "../model/types";

export type SolverOptions = {
    maxSolutions?: number;
};

export type SolverResult = {
    solutions: PuzzleSolution[];
    limitReached: boolean;
    nodesExplored: number;
    candidateChecks: number;
};

type Assignments = Record<string, Position>;

function isInsideBoard(board: Board, position: Position): boolean {
    return (
        Number.isInteger(position.row) &&
        Number.isInteger(position.col) &&
        position.row >= 0 &&
        position.row < board.size &&
        position.col >= 0 &&
        position.col < board.size
    );
}

function getRoomId(board: Board, position: Position): string | undefined {
    if (!isInsideBoard(board, position)) return undefined;
    return board.cells[position.row][position.col].roomId;
}

function getDistance(a: Position, b: Position): number {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function areBeside(board: Board, a: Position, b: Position): boolean {
    return (
        getDistance(a, b) === 1 &&
        getRoomId(board, a) !== undefined &&
        getRoomId(board, a) === getRoomId(board, b)
    );
}

function isCellOccupable(board: Board, position: Position): boolean {
    if (!isInsideBoard(board, position)) return false;

    const cell = board.cells[position.row][position.col];
    if (cell.blocked) return false;

    const referencedObjects = cell.objectIds.map(id =>
        board.objects.find(object => object.id === id)
    );

    if (referencedObjects.some(object => !object)) return false;
    if (referencedObjects.some(object => object !== undefined && !object.occupiable)) {
        return false;
    }

    const objectsAtPosition = board.objects.filter(
        object =>
            object.position.row === position.row &&
            object.position.col === position.col
    );

    return objectsAtPosition.every(object => object.occupiable);
}

function evaluateRule(
    board: Board,
    rule: ClueRule,
    position: Position,
    assignments: Assignments
): boolean | null {
    const currentRoom = getRoomId(board, position);

    switch (rule.type) {
        case "in-room":
            return currentRoom === rule.roomId;

        case "not-in-room":
            return currentRoom !== rule.roomId;

        case "on-row":
            return position.row === rule.row;

        case "on-column":
            return position.col === rule.col;

        case "on-object": {
            const object = board.objects.find(item => item.id === rule.objectId);
            if (!object) return false;
            return (
                position.row === object.position.row &&
                position.col === object.position.col
            );
        }

        case "beside-object": {
            const object = board.objects.find(item => item.id === rule.objectId);
            if (!object) return false;
            return areBeside(board, position, object.position);
        }

        case "same-room-as": {
            const other = assignments[rule.personId];
            if (!other) return null;
            return currentRoom === getRoomId(board, other);
        }

        case "different-room-from": {
            const other = assignments[rule.personId];
            if (!other) return null;
            return currentRoom !== getRoomId(board, other);
        }

        case "beside-person": {
            const other = assignments[rule.personId];
            if (!other) return null;
            return areBeside(board, position, other);
        }

        case "relative-to-person": {
            const other = assignments[rule.personId];
            if (!other) return null;

            // Relation directionnelle générale, sans distance fixe et sans
            // obligation d'être dans la même pièce.
            switch (rule.direction) {
                case "north":
                    return position.row < other.row;
                case "south":
                    return position.row > other.row;
                case "east":
                    return position.col > other.col;
                case "west":
                    return position.col < other.col;
            }
        }
    }
}

function checkAssignedClues(
    board: Board,
    clues: Clue[],
    assignments: Assignments
): boolean {
    for (const clue of clues) {
        const position = assignments[clue.personId];
        if (!position) continue;

        const result = evaluateRule(board, clue.rule, position, assignments);
        if (result === false) return false;
    }

    return true;
}

function checkMurderConstraint(
    board: Board,
    people: Person[],
    assignments: Assignments,
    complete: boolean
): boolean {
    const victim = people.find(person => person.role === "victim");
    if (!victim) return false;

    const victimPosition = assignments[victim.id];
    if (!victimPosition) return true;

    const victimRoom = getRoomId(board, victimPosition);
    let suspectsInRoom = 0;

    for (const person of people) {
        if (person.role !== "suspect") continue;
        const position = assignments[person.id];
        if (position && getRoomId(board, position) === victimRoom) {
            suspectsInRoom++;
        }
    }

    if (suspectsInRoom > 1) return false;
    return !complete || suspectsInRoom === 1;
}

function validateInput(board: Board, people: Person[], clues: Clue[]): void {
    if (
        !Number.isInteger(board.size) ||
        board.size < 2 ||
        board.cells.length !== board.size ||
        board.cells.some(row => row.length !== board.size)
    ) {
        throw new Error("Plateau invalide.");
    }

    if (people.length !== board.size) {
        throw new Error("Le nombre de personnages doit correspondre à la taille du plateau.");
    }

    if (
        people.filter(person => person.role === "victim").length !== 1 ||
        people.filter(person => person.role === "suspect").length !== board.size - 1
    ) {
        throw new Error("Répartition des personnages invalide.");
    }

    const personIds = new Set(people.map(person => person.id));
    if (personIds.size !== people.length) {
        throw new Error("Identifiants de personnages dupliqués.");
    }

    const roomIds = new Set(board.rooms.map(room => room.id));
    for (const row of board.cells) {
        for (const cell of row) {
            if (!roomIds.has(cell.roomId)) {
                throw new Error(`Pièce inconnue : ${cell.roomId}`);
            }
        }
    }

    const objectIds = new Set(board.objects.map(object => object.id));
    if (objectIds.size !== board.objects.length) {
        throw new Error("Identifiants d'objets dupliqués : chaque objet doit avoir un ID unique.");
    }

    const objectById = new Map(board.objects.map(object => [object.id, object]));
    const referencedObjectIds = new Set<string>();

    for (const object of board.objects) {
        if (!object.id || !isInsideBoard(board, object.position)) {
            throw new Error(`Objet invalide ou hors plateau : ${object.id || "sans ID"}`);
        }
    }

    // Les cellules référencent les objets par ID. Le nom n'intervient jamais
    // dans la résolution : deux objets « Table » restent deux instances distinctes.
    for (let row = 0; row < board.size; row++) {
        for (let col = 0; col < board.size; col++) {
            const cell = board.cells[row][col];
            for (const objectId of cell.objectIds) {
                const object = objectById.get(objectId);
                if (!object) {
                    throw new Error(`La case ${row},${col} référence un objet inconnu : ${objectId}`);
                }
                if (object.position.row !== row || object.position.col !== col) {
                    throw new Error(`Position incohérente pour l'objet ${objectId}.`);
                }
                if (referencedObjectIds.has(objectId)) {
                    throw new Error(`L'objet ${objectId} est référencé par plusieurs cases.`);
                }
                referencedObjectIds.add(objectId);
            }
        }
    }

    for (const object of board.objects) {
        if (!referencedObjectIds.has(object.id)) {
            throw new Error(`L'objet ${object.id} n'est référencé par aucune case.`);
        }
    }

    for (const clue of clues) {
        if (!personIds.has(clue.personId)) {
            throw new Error(`Personnage inconnu dans un indice : ${clue.personId}`);
        }

        const rule = clue.rule;

        if (
            (rule.type === "in-room" || rule.type === "not-in-room") &&
            !roomIds.has(rule.roomId)
        ) {
            throw new Error(`Pièce inconnue : ${rule.roomId}`);
        }

        if (
            (rule.type === "on-object" || rule.type === "beside-object") &&
            !objectIds.has(rule.objectId)
        ) {
            throw new Error(`Objet inconnu : ${rule.objectId}`);
        }

        if ("personId" in rule && !personIds.has(rule.personId)) {
            throw new Error(`Personnage inconnu dans un indice : ${rule.personId}`);
        }
    }
}

/** Recherche les solutions en respectant toutes les règles et les indices. */
export function solvePuzzle(
    board: Board,
    people: Person[],
    clues: Clue[],
    options: SolverOptions = {}
): SolverResult {
    validateInput(board, people, clues);

    const maxSolutions = options.maxSolutions ?? 2;
    if (!Number.isInteger(maxSolutions) || maxSolutions < 1) {
        throw new Error("maxSolutions doit être positif.");
    }

    const solutions: PuzzleSolution[] = [];
    let limitReached = false;
    let nodesExplored = 0;
    let candidateChecks = 0;

    const assignments: Assignments = {};
    const clueByPerson = new Map<string, Clue[]>();

    for (const person of people) {
        clueByPerson.set(person.id, clues.filter(clue => clue.personId === person.id));
    }

    function getCandidates(person: Person): Position[] {
        const candidates: Position[] = [];

        for (let row = 0; row < board.size; row++) {
            for (let col = 0; col < board.size; col++) {
                candidateChecks++;
                const position = { row, col };

                if (!isCellOccupable(board, position)) continue;

                const lineAlreadyUsed = people.some(other => {
                    const assigned = assignments[other.id];
                    return other.id !== person.id && assigned &&
                        (assigned.row === row || assigned.col === col);
                });
                if (lineAlreadyUsed) continue;

                const personClues = clueByPerson.get(person.id) ?? [];
                const contradictsClue = personClues.some(clue =>
                    evaluateRule(board, clue.rule, position, assignments) === false
                );

                if (!contradictsClue) candidates.push(position);
            }
        }

        return candidates;
    }

    function findMurderer(): string | null {
        const victim = people.find(person => person.role === "victim");
        if (!victim) return null;

        const victimPosition = assignments[victim.id];
        if (!victimPosition) return null;

        const victimRoom = getRoomId(board, victimPosition);
        const suspects = people.filter(person => {
            if (person.role !== "suspect") return false;
            const position = assignments[person.id];
            return position && getRoomId(board, position) === victimRoom;
        });

        return suspects.length === 1 ? suspects[0].id : null;
    }

    function search(): void {
        if (limitReached) return;
        nodesExplored++;

        const unassigned = people.filter(person => !assignments[person.id]);

        if (unassigned.length === 0) {
            if (!checkAssignedClues(board, clues, assignments)) return;
            if (!checkMurderConstraint(board, people, assignments, true)) return;

            const murdererId = findMurderer();
            if (!murdererId) return;

            const positions: Record<string, Position> = {};
            for (const person of people) {
                positions[person.id] = { ...assignments[person.id] };
            }

            solutions.push({ positions, murdererId });
            if (solutions.length >= maxSolutions) limitReached = true;
            return;
        }

        // Heuristique MRV : choisir le personnage qui a le moins de cases possibles.
        let selectedPerson: Person | null = null;
        let selectedCandidates: Position[] = [];

        for (const person of unassigned) {
            const candidates = getCandidates(person);
            if (candidates.length === 0) return;

            if (selectedPerson === null || candidates.length < selectedCandidates.length) {
                selectedPerson = person;
                selectedCandidates = candidates;
            }
        }

        if (!selectedPerson) return;

        for (const position of selectedCandidates) {
            assignments[selectedPerson.id] = position;

            const cluesValid = checkAssignedClues(board, clues, assignments);
            const murderValid = checkMurderConstraint(board, people, assignments, false);

            if (cluesValid && murderValid) search();

            delete assignments[selectedPerson.id];
            if (limitReached) return;
        }
    }

    search();

    return {
        solutions,
        limitReached,
        nodesExplored,
        candidateChecks
    };
}
