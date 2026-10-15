let sdk;
export async function loadMapSdk() {
  if (!sdk)
    sdk = (async () => {
      const response = await fetch('/api/runtime-config');
      const config = await response.json();
      if (!config.kakaoMapJavascriptKey)
        throw new Error('지도 API 연결 설정이 필요합니다.');
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(config.kakaoMapJavascriptKey)}&libraries=services&autoload=false`;
        script.onload = () =>
          window.kakao.maps.load(() => resolve(window.kakao.maps));
        script.onerror = () =>
          reject(
            new Error('지도를 불러오지 못했습니다. 연결을 확인해 주세요.'),
          );
        document.head.appendChild(script);
      });
    })();
  try {
    return await sdk;
  } catch (error) {
    sdk = null;
    throw error;
  }
}
export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error('위치 정보를 지원하지 않는 브라우저입니다.'));
    navigator.geolocation.getCurrentPosition(
      (result) =>
        resolve({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        }),
      () =>
        reject(
          new Error('위치를 확인하지 못했습니다. 위치 권한을 확인해 주세요.'),
        ),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}
