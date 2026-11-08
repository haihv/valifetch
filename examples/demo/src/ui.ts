import './style.css';
import {
  describeError,
  httpError,
  invalidBody,
  responseMismatch,
  validatedGet,
  validPost,
} from './main';

const scenarios = [
  ['Validated GET', validatedGet],
  ['Response mismatch', responseMismatch],
  ['HTTP 404', httpError],
  ['Invalid body', invalidBody],
  ['Valid POST', validPost],
] as const;

const container = document.querySelector<HTMLDivElement>('#scenarios');
const output = document.querySelector<HTMLPreElement>('#output');
if (!container || !output) throw new Error('Missing demo markup');

for (const [label, run] of scenarios) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', async () => {
    output.textContent = `${label}: running…`;
    output.dataset.state = 'pending';
    try {
      const data = await run();
      output.dataset.state = 'ok';
      output.textContent = `${label}: resolved\n\n${JSON.stringify(data, null, 2)}`;
    } catch (error) {
      output.dataset.state = 'error';
      output.textContent = `${label}: threw ValifetchError\n\n${JSON.stringify(describeError(error), null, 2)}`;
    }
  });
  container.append(button);
}
