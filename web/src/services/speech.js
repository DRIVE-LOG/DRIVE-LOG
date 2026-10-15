export function createSpeechInput({
  onText,
  onState,
  onError,
  scope = globalThis,
}) {
  const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => onState(true);
  recognition.onend = () => onState(false);
  recognition.onerror = (event) => {
    onState(false);
    onError(
      event.error === 'not-allowed'
        ? '마이크 권한을 허용한 뒤 다시 시도해 주세요.'
        : event.error === 'no-speech'
          ? '음성이 감지되지 않았습니다. 다시 시도해 주세요.'
          : '음성 인식을 사용할 수 없습니다. 텍스트로 입력해 주세요.',
    );
  };
  recognition.onresult = (event) => {
    let text = '';
    for (let i = 0; i < event.results.length; i++)
      text += event.results[i][0].transcript;
    onText(text);
  };
  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    dispose: () => {
      recognition.onstart =
        recognition.onend =
        recognition.onerror =
        recognition.onresult =
          null;
      recognition.abort();
    },
  };
}
export function speak(text, scope = globalThis) {
  if (!scope.speechSynthesis || !scope.SpeechSynthesisUtterance) return false;
  scope.speechSynthesis.cancel();
  const utterance = new scope.SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  scope.speechSynthesis.speak(utterance);
  return true;
}
