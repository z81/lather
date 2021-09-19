import { Task } from '../..';
import { info, log } from './logger';
import { get } from './get';
import { schema } from './schema';
import { _ } from '../../fn';

export const app = Task.empty
  .access<{ API_URL: string }>()
  .tap(_(log(' Fetching data...')))
  .chain(({ API_URL }) => get(API_URL))
  .chain((data) =>
    Task.succeed(data)
      .tap(_(log('Fetching success')))
      .map(JSON.parse)
      .mapError((e) => `Parsing Failed: ${e.message}`)
      .tap(_(log('Parsing success')))
      .map(schema.parse),
  )
  .chain(({ rates }) =>
    Task.sequenceFromIterable(Object.values(rates).sort((a, b) => a.value - b.value)).chain((rate) =>
      info(` ${rate.value} ${rate.unit}`.padEnd(18) + ` = 1BTC  ${rate.name} [${rate.type}]`),
    ),
  );
