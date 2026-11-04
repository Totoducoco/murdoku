import type {
    Board,
    Clue,
    Difficulty,
    Person
} from "../model/types";
import { solvePuzzle } from "./solver";

export type DifficultyEvaluation = {
    valid: boolean;
    unique: boolean;
    difficulty: Difficulty | null;
    score: number;
    solutionsFound: number;
    nodesExplored: number;
    candidateChecks: number;
    cluesPerSuspect: number;
    explanation: string;
};

function getRuleWeight(clue: Clue): number {
    switch (clue.rule.type) {
        case "on-row":
        case "on-column":
            return 0.5;
        case "in-room":
            return 1;
        case "not-in-room":
            return 1.1;
        case "on-object":
            return 1.3;
        case "same-room-as":
        case "different-room-from":
            return 1.8;
        case "beside-object":
            return 2;
        case "beside-person":
            return 2.4;
        case "relative-to-person":
            return 2.8;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Estime la difficulté d'une énigme.
 *
 * Ce score est un indicateur technique provisoire : il combine
 * la complexité des types d'indices, leur densité et le travail
 * effectué par le solveur. Il devra être calibré avec des tests joueurs.
 */
export function evaluateDifficulty(
    board: Board,
    people: Person[],
    clues: Clue[]
): DifficultyEvaluation {
    const solverResult = solvePuzzle(board, people, clues, { maxSolutions: 2 });
    const unique = solverResult.solutions.length === 1 && !solverResult.limitReached;

    if (!unique) {
        return {
            valid: false,
            unique: false,
            difficulty: null,
            score: 0,
            solutionsFound: solverResult.solutions.length,
            nodesExplored: solverResult.nodesExplored,
            candidateChecks: solverResult.candidateChecks,
            cluesPerSuspect: 0,
            explanation: solverResult.solutions.length === 0
                ? "Aucune solution ne respecte tous les indices."
                : "Plusieurs solutions sont possibles : l'énigme n'est pas encore unique."
        };
    }

    const suspectCount = Math.max(
        1,
        people.filter(person => person.role === "suspect").length
    );

    const cluesPerSuspect = clues.length / suspectCount;
    const averageRuleWeight = clues.length === 0
        ? 0
        : clues.reduce((sum, clue) => sum + getRuleWeight(clue), 0) / clues.length;

    // Trois composantes : sophistication des indices, recherche du solveur,
    // et faible densité d'indices (moins d'informations directes).
    const ruleComplexity = clamp((averageRuleWeight - 0.5) / 2.5, 0, 1);
    const searchComplexity = clamp(Math.log2(solverResult.nodesExplored + 1) / 12, 0, 1);
    const clueScarcity = 1 - clamp(cluesPerSuspect / 4, 0, 1);

    const score = Math.round(
        100 * (
            ruleComplexity * 0.45 +
            searchComplexity * 0.35 +
            clueScarcity * 0.20
        )
    );

    let difficulty: Difficulty;
    if (score < 25) {
        difficulty = "easy";
    } else if (score < 50) {
        difficulty = "normal";
    } else if (score < 75) {
        difficulty = "hard";
    } else {
        difficulty = "expert";
    }

    return {
        valid: true,
        unique: true,
        difficulty,
        score,
        solutionsFound: 1,
        nodesExplored: solverResult.nodesExplored,
        candidateChecks: solverResult.candidateChecks,
        cluesPerSuspect: Number(cluesPerSuspect.toFixed(2)),
        explanation: "Solution unique. Difficulté estimée à partir des indices et du travail du solveur ; le score reste à calibrer avec des tests joueurs."
    };
}
