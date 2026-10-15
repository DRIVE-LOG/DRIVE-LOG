import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechInput, speak } from '../web/src/services/speech.js';
test('F311/312 speech events update transcript and recording state, explain denial', () => {
  let instance;
  const text = [],
    states = [],
    errors = [];
  class Recognition {
    constructor() {
      instance = this;
    }
    start() {
      this.onstart();
    }
    stop() {
      this.onend();
    }
    abort() {
      this.aborted = true;
    }
  }
  const input = createSpeechInput({
    scope: { SpeechRecognition: Recognition },
    onText: (x) => text.push(x),
    onState: (x) => states.push(x),
    onError: (x) => errors.push(x),
  });
  input.start();
  instance.onresult({
    results: [[{ transcript: '주행 ' }], [{ transcript: '분석' }]],
  });
  input.stop();
  instance.onerror({ error: 'not-allowed' });
  assert.deepEqual(text, ['주행 분석']);
  assert.deepEqual(states, [true, false, false]);
  assert.match(errors[0], /권한/);
  assert.equal(instance.lang, 'ko-KR');
  input.dispose();
  assert.equal(instance.aborted, true);
  assert.equal(createSpeechInput({ scope: {} }), null);
});
test('F313 TTS speaks response in Korean and cancels overlap', () => {
  const calls = [];
  const scope = {
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text;
      }
    },
    speechSynthesis: {
      cancel: () => calls.push('cancel'),
      speak: (u) => calls.push(u),
    },
  };
  assert.equal(speak('응답', scope), true);
  assert.equal(calls[0], 'cancel');
  assert.equal(calls[1].text, '응답');
  assert.equal(calls[1].lang, 'ko-KR');
  assert.equal(speak('x', {}), false);
});
