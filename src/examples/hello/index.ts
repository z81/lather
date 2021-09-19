import { Task } from '../..';
import { Queue } from '../../queue';

const messageQueue = new Queue<string>();

const server = Task.empty.access<{ queue: Queue<string> }>().chain(({ queue }) =>
  Task.fromCallback<undefined>((done) => {
    {
      let i = 0;
      setInterval(() => {
        queue.add(`${i++}`);
      }, 200);
    }
  }),
);

const consumer1 = Task.empty.access<{ queue: Queue<string> }>().chain(({ queue }) =>
  Task.sequenceFromGen(async function* () {
    for await (const m of queue) {
      console.log('@1', m);
    }
    yield 1;
  }),
);

const consumer2 = Task.empty
  .access<{ queue: Queue<string> }>()
  .chain(({ queue }) => Task.sequenceFromIterable(queue).tap((msg) => console.log(`@2 ${msg}`)));

Task.structPar({
  server,
  consumer1,
  consumer2,
})
  .provide({
    queue: messageQueue,
  })
  .runUnsafe();
