import { eq, asc, avg, count, isNotNull } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

export type CatalogSummary = {
    totalGames: number;
    averageRating: number | null;
};

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

/** Aggregate catalog stats: total games and the average star rating across rated games. */
export async function getCatalogSummary(db: Database): Promise<CatalogSummary> {
    const totalResult = await db.select({ totalGames: count(games.id) }).from(games).get();
    const averageResult = await db
        .select({ averageRating: avg(games.starRating) })
        .from(games)
        .where(isNotNull(games.starRating))
        .get();

    const rawTotalGames = totalResult?.totalGames ?? 0;
    const totalGames = typeof rawTotalGames === 'number' ? rawTotalGames : Number(rawTotalGames) || 0;
    const rawAverageRating = averageResult?.averageRating ?? null;
    const parsedAverageRating =
        typeof rawAverageRating === 'number'
            ? rawAverageRating
            : typeof rawAverageRating === 'string'
              ? Number(rawAverageRating)
              : null;

    return {
        totalGames,
        averageRating:
            typeof parsedAverageRating === 'number' && Number.isFinite(parsedAverageRating)
                ? Number(parsedAverageRating.toFixed(2))
                : null,
    };
}
