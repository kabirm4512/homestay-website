import { SqlOrTx } from './db';

/** Atomically increments and returns a named counter (starts at `start` when new). */
export async function nextCounter(db: SqlOrTx, name: string, start = 1): Promise<number> {
  const rows = await db<{ value: string }[]>`
    insert into pms.counters as c (name, value) values (${name}, ${start})
    on conflict (name) do update set value = c.value + 1
    returning value::text as value`;
  return Number(rows[0].value);
}
