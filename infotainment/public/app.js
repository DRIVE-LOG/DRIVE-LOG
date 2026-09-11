const viewLabels = {
  home: '인포테인먼트 홈',
  navigation: '내비게이션',
  weather: '날씨',
  settings: '로그 관리',
};

const placeHistoryStorageKey = 'aurelia-place-history';
const defaultPlaceHistory = [
  {
    name: '서울역',
    address: '서울 용산구 한강대로 405',
    distance: '3.2 km · 약 12분',
    distanceValue: '3.2 km',
    durationMinutes: 12,
    latitude: 37.5546788,
    longitude: 126.9706069,
  },
  {
    name: '남산서울타워',
    address: '서울 용산구 남산공원길 105',
    distance: '5.8 km · 약 19분',
    distanceValue: '5.8 km',
    durationMinutes: 19,
    latitude: 37.5511694,
    longitude: 126.9882266,
  },
  {
    name: '코엑스',
    address: '서울 강남구 영동대로 513',
    distance: '11.4 km · 약 31분',
    distanceValue: '11.4 km',
    durationMinutes: 31,
    latitude: 37.5116621,
    longitude: 127.059427,
  },
  {
    name: '서울숲',
    address: '서울 성동구 뚝섬로 273',
    distance: '8.7 km · 약 24분',
    distanceValue: '8.7 km',
    durationMinutes: 24,
    latitude: 37.5443878,
    longitude: 127.0374424,
  },
  {
    name: '경복궁',
    address: '서울 종로구 사직로 161',
    distance: '4.6 km · 약 17분',
    distanceValue: '4.6 km',
    durationMinutes: 17,
    latitude: 37.579617,
    longitude: 126.977041,
  },
];
let placeHistory = loadPlaceHistory();

const appViews = [...document.querySelectorAll('.app-view')];
const viewButtons = [...document.querySelectorAll('[data-view-target]')];
const dockButtons = [...document.querySelectorAll('.dock-button')];
const headerClock = document.querySelector('#header-clock');
const headerWeatherIcon = document.querySelector('#header-weather-icon');
const headerWeatherTemperature = document.querySelector(
  '#header-weather-temperature',
);
const headerWeatherDescription = document.querySelector(
  '#header-weather-description',
);
const driveLocation = document.querySelector('.drive-location');
const weatherDate = document.querySelector('#weather-date');
const weatherTitle = document.querySelector('#weather-title');
const weatherHeroIcon = document.querySelector('#weather-hero-icon');
const weatherCurrentTemperature = document.querySelector(
  '#weather-current-temperature',
);
const weatherCurrentDescription = document.querySelector(
  '#weather-current-description',
);
const weatherCurrentFeelsLike = document.querySelector(
  '#weather-current-feels-like',
);
const weatherHumidity = document.querySelector('#weather-humidity');
const weatherWind = document.querySelector('#weather-wind');
const weatherPressure = document.querySelector('#weather-pressure');
const weatherVisibility = document.querySelector('#weather-visibility');
const drivingTipCopy = document.querySelector('#driving-tip-copy');
const homeWeatherCity = document.querySelector('#home-weather-city');
const homeWeatherIcon = document.querySelector('#home-weather-icon');
const homeWeatherTemperature = document.querySelector(
  '#home-weather-temperature',
);
const homeWeatherDescription = document.querySelector(
  '#home-weather-description',
);
const homeWeatherFeelsLike = document.querySelector('#home-weather-feels-like');
const homeMiniForecast = document.querySelector('#home-mini-forecast');
const searchForm = document.querySelector('#place-search-form');
const searchInput = document.querySelector('#place-search');
const autocompleteList = document.querySelector('#autocomplete-list');
const searchResults = document.querySelector('#search-result-list');
const searchListTitle = document.querySelector('#search-list-title');
const clearHistoryButton = document.querySelector('#clear-history');
const mapDestination = document.querySelector('#map-destination');
const routeArrival = document.querySelector('#route-arrival');
const routeDuration = document.querySelector('#route-duration');
const routeDistance = document.querySelector('#route-distance');
const routeStepDistance = document.querySelector('#route-step-distance');
const routeStepInstruction = document.querySelector('#route-step-instruction');
const routeSavings = document.querySelector('#route-savings');
const routeCancelButton = document.querySelector('#route-cancel');
const routeBanner = document.querySelector('.route-banner');
const routeSummary = document.querySelector('.route-summary');
const destinationPin = document.querySelector('.destination-pin');
const fallbackRouteLines = [...document.querySelectorAll('.route-line')];
const routeConfirmation = document.querySelector('#route-confirmation');
const routeConfirmationName = document.querySelector(
  '#route-confirmation-name',
);
const routeConfirmationAddress = document.querySelector(
  '#route-confirmation-address',
);
const routeConfirmationEta = document.querySelector(
  '.route-confirmation-eta',
);
const routeConfirmationEtaValue = document.querySelector(
  '#route-confirmation-eta-value',
);
const routeConfirmationCancel = document.querySelector(
  '#route-confirmation-cancel',
);
const routeConfirmationStart = document.querySelector(
  '#route-confirmation-start',
);
const orientationButton = document.querySelector('#forecast-orientation');
const forecastCards = document.querySelector('#forecast-cards');
const dailyOutlooks = [0, 1].map((index) => ({
  label: document.querySelector(`#daily-outlook-label-${index}`),
  track: document.querySelector(`#daily-outlook-track-${index}`),
  minimum: document.querySelector(`#daily-outlook-min-${index}`),
  maximum: document.querySelector(`#daily-outlook-max-${index}`),
}));
const mediaToggle = document.querySelector('#media-toggle');
const toast = document.querySelector('#app-toast');
const infotainmentScreen = document.querySelector('.infotainment-screen');
const homeMapContainer = document.querySelector('#home-kakao-map');
const homeMapAddress = document.querySelector('#home-map-address');
const homeMapSelectionStatus = document.querySelector(
  '#home-map-selection-status',
);
const navigationMapContainer = document.querySelector('#navigation-kakao-map');

const initialView = location.hash.slice(1);
let currentView = initialView === 'logs' ? 'settings' : Object.hasOwn(viewLabels, initialView) ? initialView : 'home';
let toastTimer;
let autocompleteMatches = [];
let activeAutocompleteIndex = -1;
let homeMap;
let navigationMap;
let currentPosition;
let kakaoMaps;
let kakaoPlacesService;
let kakaoGeocoder;
let destinationOverlay;
let destinationPosition;
let routePolyline;
let homeSelectionOverlay;
let activeNavigationBounds;
let directionsRequestId = 0;
let pendingRoutePlace;
let pendingRoute;
let routeConfirmationReturnFocus;
let routePreviewRequestId = 0;
let mapSelectionRequestId = 0;
let mapResizeObserver;
let mapRelayoutFrame;
let weatherTimezoneOffset = 0;
let latestWeatherLocation;
let weatherRequestId = 0;
let lastWeatherUpdateAt = 0;
let forecastDragState;

const fallbackLocation = {
  latitude: 37.566535,
  longitude: 126.9779692,
};

function loadPlaceHistory() {
  try {
    const storedHistory = JSON.parse(
      window.localStorage.getItem(placeHistoryStorageKey) ?? 'null',
    );

    if (!Array.isArray(storedHistory)) {
      return [...defaultPlaceHistory];
    }

    return storedHistory.filter(
      (place) =>
        typeof place?.name === 'string' &&
        typeof place?.address === 'string',
    );
  } catch {
    return [...defaultPlaceHistory];
  }
}

function persistPlaceHistory() {
  try {
    window.localStorage.setItem(
      placeHistoryStorageKey,
      JSON.stringify(placeHistory),
    );
  } catch {
    // The UI continues to work when browser storage is unavailable.
  }
}

function rememberPlace(place) {
  const historyItem = {
    name: place.name,
    address: place.address,
    category: place.category || '최근 목적지',
    latitude: place.latitude,
    longitude: place.longitude,
    distanceValue: place.distanceValue,
    durationMinutes: place.durationMinutes,
  };

  placeHistory = [
    historyItem,
    ...placeHistory.filter(
      (item) => item.name !== place.name || item.address !== place.address,
    ),
  ].slice(0, 5);
  persistPlaceHistory();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('app-toast--visible');
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('app-toast--visible');
  }, 2400);
}

function fitNavigationBounds(bounds, { relayout = false } = {}) {
  if (!navigationMap || !bounds) {
    return;
  }

  if (relayout) {
    navigationMap.relayout();
  }

  const bottomPadding = routeSummary.hidden
    ? 70
    : Math.max(120, routeSummary.offsetHeight + 32);
  activeNavigationBounds = bounds;
  navigationMap.setBounds(bounds, 70, 70, bottomPadding, 70);
}

function relayoutVisibleMaps() {
  [
    { map: homeMap, container: homeMapContainer },
    { map: navigationMap, container: navigationMapContainer },
  ].forEach(({ map, container }) => {
    const view = container.closest('.app-view');

    if (!map || view?.hidden) {
      return;
    }

    const center = map.getCenter();
    map.relayout();

    if (map === navigationMap && activeNavigationBounds) {
      fitNavigationBounds(activeNavigationBounds);
    } else {
      map.setCenter(center);
    }
  });
}

function scheduleMapRelayout() {
  window.cancelAnimationFrame(mapRelayoutFrame);
  mapRelayoutFrame = window.requestAnimationFrame(relayoutVisibleMaps);
}

function setView(viewName) {
  if (!viewLabels[viewName]) {
    return;
  }

  const previouslyFocusedElement = document.activeElement;
  currentView = viewName;
  if (location.hash !== `#${viewName}`) history.replaceState(null, '', `#${viewName}`);
  if (viewName === 'settings') {
    const frame = document.querySelector('#logs-frame');
    if (!frame.hasAttribute('src')) frame.src = frame.dataset.src;
  }

  appViews.forEach((view) => {
    const isActive = view.dataset.view === viewName;
    view.hidden = !isActive;
    view.classList.toggle('app-view--active', isActive);
  });

  dockButtons.forEach((button) => {
    const isActive = button.dataset.viewTarget === viewName;
    button.classList.toggle('dock-button--active', isActive);

    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  document.title = `${viewLabels[viewName]} | AURELIA DRIVE`;

  const previouslyFocusedView = previouslyFocusedElement?.closest?.('.app-view');
  if (previouslyFocusedView?.hidden) {
    const activeView = appViews.find((view) => view.dataset.view === viewName);
    activeView?.querySelector('h1, h2')?.focus({ preventScroll: true });
  }

  if (viewName === 'navigation' && navigationMap) {
    window.requestAnimationFrame(() => {
      navigationMap.relayout();

      if (activeNavigationBounds) {
        fitNavigationBounds(activeNavigationBounds);
      } else if (currentPosition && !destinationPosition) {
        navigationMap.setCenter(currentPosition);
      }
    });
  } else if (viewName === 'home' && homeMap) {
    scheduleMapRelayout();
  }
}

viewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setView(button.dataset.viewTarget);
  });
});

function updateDateTime() {
  const now = new Date();
  const timeText = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const dateText = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now);

  headerClock.textContent = timeText;
  headerClock.dateTime = now.toISOString();
  weatherDate.textContent = dateText;
}

function renderAutocomplete(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  autocompleteMatches = placeHistory.filter((place) => {
    if (!normalizedQuery) {
      return false;
    }

    return [place.name, place.address].some((value) =>
      value.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
    );
  });

  autocompleteList.replaceChildren();

  autocompleteMatches.forEach((place, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    const address = document.createElement('small');

    button.type = 'button';
    item.setAttribute('role', 'presentation');
    button.setAttribute('role', 'option');
    button.id = `autocomplete-option-${index}`;
    button.setAttribute('aria-selected', 'false');
    button.dataset.autocompleteIndex = String(index);
    icon.textContent = '⌖';
    icon.setAttribute('aria-hidden', 'true');
    name.textContent = place.name;
    address.textContent = place.address;
    copy.append(name, address);
    button.append(icon, copy);
    button.addEventListener('click', () => selectPlace(place));
    item.append(button);
    autocompleteList.append(item);
  });

  activeAutocompleteIndex = -1;
  searchInput.removeAttribute('aria-activedescendant');

  const isOpen = autocompleteMatches.length > 0;
  autocompleteList.hidden = !isOpen;
  searchInput.setAttribute('aria-expanded', String(isOpen));
}

function closeAutocomplete() {
  autocompleteList.hidden = true;
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.removeAttribute('aria-activedescendant');
  autocompleteMatches = [];
  activeAutocompleteIndex = -1;
}

function setActiveAutocompleteOption(index) {
  if (!autocompleteMatches.length) {
    return;
  }

  activeAutocompleteIndex =
    (index + autocompleteMatches.length) % autocompleteMatches.length;

  autocompleteList.querySelectorAll('[role="option"]').forEach((option) => {
    const optionIndex = Number(option.dataset.autocompleteIndex);
    const isActive = optionIndex === activeAutocompleteIndex;
    option.setAttribute('aria-selected', String(isActive));
  });

  searchInput.setAttribute(
    'aria-activedescendant',
    `autocomplete-option-${activeAutocompleteIndex}`,
  );
}

function formatArrivalTime(durationSeconds) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(Date.now() + durationSeconds * 1_000));
}

function getRouteDurationSeconds(route) {
  const durationSeconds = Number(route?.summary?.duration);

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Route duration is invalid');
  }

  return durationSeconds;
}

function setRouteConfirmationEta(message, state) {
  routeConfirmationEtaValue.textContent = message;
  routeConfirmationEta.dataset.state = state;
}

async function prepareRouteConfirmation(place, requestId) {
  try {
    const route = await fetchDirectionsRoute(place);

    if (
      requestId !== routePreviewRequestId ||
      routeConfirmation.hidden ||
      pendingRoutePlace !== place
    ) {
      return;
    }

    const durationSeconds = getRouteDurationSeconds(route);
    const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
    pendingRoute = route;
    setRouteConfirmationEta(
      `${formatArrivalTime(durationSeconds)} · 약 ${durationMinutes}분`,
      'ready',
    );
  } catch {
    if (
      requestId !== routePreviewRequestId ||
      routeConfirmation.hidden ||
      pendingRoutePlace !== place
    ) {
      return;
    }

    pendingRoute = undefined;
    setRouteConfirmationEta('계산 실패 · 안내 시작 후 다시 시도', 'error');
  } finally {
    if (
      requestId === routePreviewRequestId &&
      !routeConfirmation.hidden &&
      pendingRoutePlace === place
    ) {
      routeConfirmationStart.disabled = false;
      routeConfirmation.removeAttribute('aria-busy');
    }
  }
}

function selectPlace(place) {
  const requestId = ++routePreviewRequestId;
  searchInput.value = place.name;
  closeAutocomplete();
  pendingRoutePlace = place;
  pendingRoute = undefined;
  routeConfirmationReturnFocus = document.activeElement;
  routeConfirmationName.textContent = place.name;
  routeConfirmationAddress.textContent =
    place.address || '선택한 위치로 경로를 안내합니다.';
  setRouteConfirmationEta('실시간 경로 계산 중…', 'loading');
  routeConfirmationStart.disabled = true;
  routeConfirmation.setAttribute('aria-busy', 'true');
  routeConfirmation.hidden = false;

  const hasCoordinates =
    Number.isFinite(place.latitude) && Number.isFinite(place.longitude);

  if (hasCoordinates && window.axios && currentPosition) {
    prepareRouteConfirmation(place, requestId);
  } else {
    const durationMinutes = Number(place.durationMinutes);

    if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
      setRouteConfirmationEta(
        `${formatArrivalTime(durationMinutes * 60)} · 약 ${Math.ceil(durationMinutes)}분`,
        'ready',
      );
    } else {
      setRouteConfirmationEta('안내 시작 후 계산', 'error');
    }

    routeConfirmationStart.disabled = false;
    routeConfirmation.removeAttribute('aria-busy');
  }

  window.requestAnimationFrame(() => {
    (routeConfirmationStart.disabled
      ? routeConfirmationCancel
      : routeConfirmationStart
    ).focus();
  });
}

function closeRouteConfirmation({ restoreFocus = true } = {}) {
  routePreviewRequestId += 1;
  routeConfirmation.hidden = true;
  pendingRoutePlace = undefined;
  pendingRoute = undefined;
  routeConfirmationStart.disabled = false;
  routeConfirmation.removeAttribute('aria-busy');

  if (restoreFocus && routeConfirmationReturnFocus?.isConnected) {
    routeConfirmationReturnFocus.focus();
  }

  routeConfirmationReturnFocus = undefined;
}

function startGuidance(place, preparedRoute) {
  setView('navigation');
  clearHomeMapSelection();
  clearRouteGuidance();
  searchInput.value = place.name;
  mapDestination.textContent = place.name;
  setRouteGuidanceVisibility(true);

  const hasCoordinates =
    Number.isFinite(place.latitude) && Number.isFinite(place.longitude);

  if (hasCoordinates && navigationMap && kakaoMaps) {
    showPlaceOnNavigationMap(place);
    routeArrival.textContent = '--:--';
    routeDuration.textContent = '계산 중';
    routeDistance.textContent = '--';
    routeStepDistance.textContent = '경로 준비';
    routeStepInstruction.textContent = `${place.name}까지 경로를 계산합니다`;
    routeSavings.textContent = 'API 연결';

    if (preparedRoute) {
      try {
        renderDirections(preparedRoute, place);
      } catch {
        requestDirections(place);
      }
    } else {
      requestDirections(place);
    }
  } else {
    routeDuration.textContent = `${place.durationMinutes}분`;
    routeDistance.textContent = place.distanceValue;
    routeArrival.textContent = formatArrivalTime(place.durationMinutes * 60);
  }

  closeAutocomplete();
  rememberPlace(place);

  document.querySelectorAll('.place-card').forEach((card) => {
    card.classList.toggle('place-card--active', card.dataset.place === place.name);
  });
}

function createPlaceCard(place) {
  const card = document.createElement('button');
  const icon = document.createElement('span');
  const copy = document.createElement('span');
  const name = document.createElement('strong');
  const address = document.createElement('small');
  const category = document.createElement('em');
  const arrow = document.createElement('i');

  card.className = 'place-card';
  card.type = 'button';
  card.dataset.place = place.name;
  icon.className = 'place-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⌖';
  copy.className = 'place-copy';
  name.textContent = place.name;
  address.textContent = place.address;
  category.textContent = place.category || '검색 결과';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '›';
  copy.append(name, address, category);
  card.append(icon, copy, arrow);
  card.addEventListener('click', () => selectPlace(place));

  return card;
}

function renderPlaceResults(places) {
  searchResults.replaceChildren(...places.map(createPlaceCard));
  searchResults.hidden = false;
  searchResults.removeAttribute('aria-busy');
  searchListTitle.textContent = '검색 결과';
  clearHistoryButton.textContent = '최근 검색';
  clearHistoryButton.dataset.action = 'show-history';
  clearHistoryButton.disabled = false;
}

function renderRecentHistory() {
  searchListTitle.textContent = '최근 검색';
  clearHistoryButton.textContent = '전체 삭제';
  clearHistoryButton.dataset.action = 'clear-history';
  searchResults.hidden = false;

  if (!placeHistory.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'search-empty';
    emptyMessage.textContent = '최근 검색한 목적지가 없습니다.';
    searchResults.replaceChildren(emptyMessage);
    clearHistoryButton.disabled = true;
    return;
  }

  searchResults.replaceChildren(...placeHistory.map(createPlaceCard));
  clearHistoryButton.disabled = false;
}

function searchKakaoPlaces(query) {
  return new Promise((resolve, reject) => {
    kakaoPlacesService.keywordSearch(
      query,
      (results, status) => {
        if (status === kakaoMaps.maps.services.Status.OK) {
          resolve(
            results.map((place) => ({
              name: place.place_name,
              address: place.road_address_name || place.address_name,
              category: place.category_group_name || '장소',
              latitude: Number(place.y),
              longitude: Number(place.x),
            })),
          );
          return;
        }

        if (status === kakaoMaps.maps.services.Status.ZERO_RESULT) {
          resolve([]);
          return;
        }

        reject(new Error('Kakao place search failed'));
      },
      {
        size: 5,
        sort: kakaoMaps.maps.services.SortBy.ACCURACY,
      },
    );
  });
}

function createHomeSelectionContent(place, { loading = false } = {}) {
  const content = document.createElement('div');
  const card = document.createElement('div');
  const eyebrow = document.createElement('small');
  const name = document.createElement('strong');
  const address = document.createElement('small');
  const pin = document.createElement('span');

  content.className = 'api-home-selection';
  content.dataset.loading = String(loading);
  card.className = 'api-home-selection-card';
  eyebrow.textContent = loading ? 'CHECKING LOCATION' : 'SELECTED LOCATION';
  name.textContent = place.name;
  address.textContent = place.address;
  pin.className = 'api-home-selection-pin';
  pin.setAttribute('aria-hidden', 'true');
  card.append(eyebrow, name, address);

  if (!loading) {
    const action = document.createElement('button');
    const arrow = document.createElement('span');

    action.type = 'button';
    action.className = 'api-home-selection-action';
    action.setAttribute('aria-label', `${place.name} 위치로 길안내`);
    action.textContent = '이 위치로 길안내';
    arrow.textContent = '›';
    arrow.setAttribute('aria-hidden', 'true');
    action.append(arrow);
    action.addEventListener('click', (event) => {
      event.stopPropagation();
      selectPlace(place);
    });
    card.append(action);
  }

  content.append(card, pin);
  return content;
}

function showHomeMapSelection(position, place, options) {
  homeSelectionOverlay?.setMap(null);
  homeSelectionOverlay = new kakaoMaps.maps.CustomOverlay({
    map: homeMap,
    position,
    content: createHomeSelectionContent(place, options),
    xAnchor: 0.5,
    yAnchor: 1.02,
    zIndex: 8,
    clickable: true,
  });

  homeMapSelectionStatus.textContent = options?.loading
    ? '선택한 위치의 주소를 확인하고 있습니다.'
    : `${place.name}, ${place.address}. 이 위치로 길안내를 선택할 수 있습니다.`;
}

function clearHomeMapSelection() {
  homeSelectionOverlay?.setMap(null);
  homeSelectionOverlay = null;
  homeMapSelectionStatus.textContent = '';
}

function showPlaceOnNavigationMap(place) {
  const destination = new kakaoMaps.maps.LatLng(
    place.latitude,
    place.longitude,
  );
  const content = document.createElement('div');
  const pin = document.createElement('span');
  const label = document.createElement('strong');

  content.className = 'api-destination-marker';
  pin.setAttribute('aria-hidden', 'true');
  pin.textContent = '●';
  label.textContent = place.name;
  content.append(pin, label);

  if (destinationOverlay) {
    destinationOverlay.setMap(null);
  }

  destinationOverlay = new kakaoMaps.maps.CustomOverlay({
    map: navigationMap,
    position: destination,
    content,
    xAnchor: 0.5,
    yAnchor: 1.1,
    zIndex: 7,
  });
  destinationPosition = destination;

  const bounds = new kakaoMaps.maps.LatLngBounds();
  bounds.extend(currentPosition);
  bounds.extend(destination);
  fitNavigationBounds(bounds, { relayout: true });
}

function formatDistance(meters) {
  if (meters < 1_000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1_000).toFixed(1)} km`;
}

function setRouteGuidanceVisibility(isVisible) {
  routeBanner.hidden = !isVisible;
  routeSummary.hidden = !isVisible;
  destinationPin.hidden = !isVisible;
  fallbackRouteLines.forEach((line) => {
    line.hidden = !isVisible;
  });
}

function clearRouteGuidance({ resetSearch = false } = {}) {
  directionsRequestId += 1;
  activeNavigationBounds = null;
  routePolyline?.setMap(null);
  destinationOverlay?.setMap(null);
  routePolyline = null;
  destinationOverlay = null;
  destinationPosition = null;
  mapDestination.textContent = '';
  routeArrival.textContent = '--:--';
  routeDuration.textContent = '--';
  routeDistance.textContent = '--';
  routeStepDistance.textContent = '경로 준비';
  routeStepInstruction.textContent = '';
  routeSavings.textContent = '대기';
  setRouteGuidanceVisibility(false);

  document.querySelectorAll('.place-card--active').forEach((card) => {
    card.classList.remove('place-card--active');
  });

  if (resetSearch) {
    searchInput.value = '';
    closeAutocomplete();
    renderRecentHistory();
  }

  if (navigationMap && currentPosition) {
    navigationMap.relayout();
    navigationMap.setCenter(currentPosition);
    navigationMap.setLevel(5);
  }
}

function getRoutePath(route) {
  return (route.sections ?? []).flatMap((section) =>
    (section.roads ?? []).flatMap((road) => {
      const path = [];
      const vertexes = road.vertexes ?? [];

      for (let index = 0; index < vertexes.length; index += 2) {
        const longitude = Number(vertexes[index]);
        const latitude = Number(vertexes[index + 1]);

        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
          path.push(new kakaoMaps.maps.LatLng(latitude, longitude));
        }
      }

      return path;
    }),
  );
}

function renderDirections(route, place) {
  const path = getRoutePath(route);

  if (!route.summary || path.length < 2) {
    throw new Error('Route geometry is missing');
  }

  if (routePolyline) {
    routePolyline.setMap(null);
  }

  routePolyline = new kakaoMaps.maps.Polyline({
    map: navigationMap,
    path,
    strokeWeight: 6,
    strokeColor: '#6fffd5',
    strokeOpacity: 0.9,
    strokeStyle: 'solid',
  });

  const durationSeconds = getRouteDurationSeconds(route);
  const distanceMeters = Number(route.summary.distance);

  if (!Number.isFinite(durationSeconds) || !Number.isFinite(distanceMeters)) {
    throw new Error('Route summary is invalid');
  }

  const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
  const guides = (route.sections ?? []).flatMap(
    (section) => section.guides ?? [],
  );
  const nextGuide = guides.find(
    (guide) => guide.type !== 100 && guide.type !== 101,
  );

  routeArrival.textContent = formatArrivalTime(durationSeconds);
  routeDuration.textContent = `${durationMinutes}분`;
  routeDistance.textContent = formatDistance(distanceMeters);
  routeStepDistance.textContent =
    nextGuide && Number.isFinite(Number(nextGuide.distance))
      ? formatDistance(Number(nextGuide.distance))
      : '추천 경로';
  routeStepInstruction.textContent =
    nextGuide?.guidance || `${place.name} 방면으로 이동하세요`;
  routeSavings.textContent = '실시간';

  const bounds = new kakaoMaps.maps.LatLngBounds();
  path.forEach((position) => bounds.extend(position));
  fitNavigationBounds(bounds);
}

async function fetchDirectionsRoute(place) {
  if (
    !window.axios ||
    !currentPosition ||
    !Number.isFinite(place.latitude) ||
    !Number.isFinite(place.longitude)
  ) {
    throw new Error('Directions are unavailable');
  }

  const response = await window.axios.get('/api/directions', {
    params: {
      origin: `${currentPosition.getLng()},${currentPosition.getLat()}`,
      destination: `${place.longitude},${place.latitude}`,
    },
  });
  const route = response.data.routes?.find(
    (candidate) => candidate.result_code === 0,
  );

  if (!route) {
    throw new Error('No available route');
  }

  return route;
}

async function requestDirections(place) {
  const requestId = ++directionsRequestId;

  try {
    const route = await fetchDirectionsRoute(place);

    if (requestId !== directionsRequestId) {
      return;
    }

    renderDirections(route, place);
  } catch (error) {
    if (requestId !== directionsRequestId) {
      return;
    }

    const isMissingKey =
      error.response?.data?.error?.code === 'API_KEY_MISSING';
    routeDuration.textContent = isMissingKey ? '키 필요' : '연결 실패';
    routeStepDistance.textContent = '경로 안내';
    routeStepInstruction.textContent = isMissingKey
      ? 'Kakao Mobility API 키를 설정해 주세요'
      : '경로 정보를 불러오지 못했습니다';
    routeSavings.textContent = '대기';
    showToast(
      isMissingKey
        ? 'Kakao Mobility API 키 설정이 필요합니다.'
        : '경로 정보를 불러오지 못했습니다.',
    );
  }
}

searchInput.addEventListener('input', (event) => {
  renderAutocomplete(event.target.value);
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' && autocompleteMatches.length) {
    event.preventDefault();
    setActiveAutocompleteOption(activeAutocompleteIndex + 1);
    return;
  }

  if (event.key === 'ArrowUp' && autocompleteMatches.length) {
    event.preventDefault();
    setActiveAutocompleteOption(activeAutocompleteIndex - 1);
    return;
  }

  if (event.key === 'Enter' && activeAutocompleteIndex >= 0) {
    event.preventDefault();
    selectPlace(autocompleteMatches[activeAutocompleteIndex]);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    searchForm.requestSubmit();
    return;
  }

  if (event.key === 'Escape') {
    closeAutocomplete();
  }
});

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();

  if (!query) {
    showToast('검색할 장소나 주소를 입력해 주세요.');
    return;
  }

  if (kakaoPlacesService) {
    closeAutocomplete();
    searchResults.setAttribute('aria-busy', 'true');

    try {
      const places = await searchKakaoPlaces(query);

      if (!places.length) {
        searchResults.removeAttribute('aria-busy');
        showToast('검색 결과가 없습니다. 다른 키워드를 입력해 주세요.');
        return;
      }

      renderPlaceResults(places);
    } catch {
      searchResults.removeAttribute('aria-busy');
      showToast('장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }

    return;
  }

  const normalizedQuery = query.toLocaleLowerCase('ko-KR');
  const place = placeHistory.find((item) =>
    [item.name, item.address].some((value) =>
      value.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
    ),
  );

  if (place) {
    selectPlace(place);
    return;
  }

  closeAutocomplete();
  showToast('실제 장소 검색 결과는 API 연동 단계에서 연결됩니다.');
});

routeConfirmationStart.addEventListener('click', () => {
  const place = pendingRoutePlace;
  const preparedRoute = pendingRoute;

  if (!place) {
    closeRouteConfirmation();
    return;
  }

  closeRouteConfirmation({ restoreFocus: false });
  startGuidance(place, preparedRoute);
});

routeConfirmationCancel.addEventListener('click', () => {
  closeRouteConfirmation();
});

routeConfirmation.addEventListener('click', (event) => {
  if (event.target === routeConfirmation) {
    closeRouteConfirmation();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !routeConfirmation.hidden) {
    event.preventDefault();
    closeRouteConfirmation();
  }
});

document.addEventListener('click', (event) => {
  if (!searchForm.contains(event.target)) {
    closeAutocomplete();
  }
});

document.querySelectorAll('.place-card').forEach((card) => {
  card.addEventListener('click', () => {
    const place = placeHistory.find((item) => item.name === card.dataset.place);
    if (place) {
      selectPlace(place);
    }
  });
});

clearHistoryButton.addEventListener('click', () => {
  if (clearHistoryButton.dataset.action === 'show-history') {
    renderRecentHistory();
    return;
  }

  placeHistory = [];

  try {
    window.localStorage.removeItem(placeHistoryStorageKey);
  } catch {
    // The in-memory history is still cleared when storage is unavailable.
  }

  renderRecentHistory();
  closeAutocomplete();
});

routeCancelButton.addEventListener('click', () => {
  clearRouteGuidance({ resetSearch: true });
  searchInput.focus();
});

orientationButton.addEventListener('click', () => {
  const isVertical = forecastCards.dataset.orientation === 'vertical';
  const nextOrientation = isVertical ? 'horizontal' : 'vertical';

  finishForecastDrag();
  forecastCards.dataset.orientation = nextOrientation;
  forecastCards.scrollTo({ top: 0, left: 0 });
  orientationButton.setAttribute('aria-pressed', String(!isVertical));
  orientationButton.innerHTML = isVertical
    ? '<span aria-hidden="true">↕</span> 세로 보기'
    : '<span aria-hidden="true">↔</span> 가로 보기';
});

function finishForecastDrag(pointerId) {
  if (!forecastDragState) {
    return;
  }

  const activePointerId = forecastDragState.pointerId;
  forecastDragState = undefined;
  forecastCards.classList.remove('forecast-cards--dragging');

  if (
    pointerId === activePointerId &&
    forecastCards.hasPointerCapture?.(activePointerId)
  ) {
    forecastCards.releasePointerCapture(activePointerId);
  }
}

forecastCards.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  const axis =
    forecastCards.dataset.orientation === 'vertical' ? 'vertical' : 'horizontal';
  forecastDragState = {
    axis,
    pointerId: event.pointerId,
    startPosition: axis === 'horizontal' ? event.clientX : event.clientY,
    startScrollPosition:
      axis === 'horizontal'
        ? forecastCards.scrollLeft
        : forecastCards.scrollTop,
  };
  forecastCards.classList.add('forecast-cards--dragging');
  forecastCards.setPointerCapture?.(event.pointerId);
});

forecastCards.addEventListener('pointermove', (event) => {
  if (forecastDragState?.pointerId !== event.pointerId) {
    return;
  }

  const isHorizontal = forecastDragState.axis === 'horizontal';
  const currentPosition = isHorizontal ? event.clientX : event.clientY;
  const distance = currentPosition - forecastDragState.startPosition;

  if (Math.abs(distance) > 3) {
    event.preventDefault();
  }

  if (isHorizontal) {
    forecastCards.scrollLeft =
      forecastDragState.startScrollPosition - distance;
  } else {
    forecastCards.scrollTop =
      forecastDragState.startScrollPosition - distance;
  }
});

forecastCards.addEventListener('pointerup', (event) => {
  finishForecastDrag(event.pointerId);
});

forecastCards.addEventListener('pointercancel', (event) => {
  finishForecastDrag(event.pointerId);
});

forecastCards.addEventListener('lostpointercapture', () => {
  finishForecastDrag();
});

forecastCards.addEventListener('dragstart', (event) => {
  event.preventDefault();
});

forecastCards.addEventListener('keydown', (event) => {
  const isHorizontal = forecastCards.dataset.orientation === 'horizontal';
  const supportedKeys = isHorizontal
    ? ['ArrowLeft', 'ArrowRight']
    : ['ArrowUp', 'ArrowDown'];

  if (!supportedKeys.includes(event.key)) {
    return;
  }

  event.preventDefault();
  forecastCards.scrollBy({
    left: isHorizontal
      ? event.key === 'ArrowRight'
        ? 250
        : -250
      : 0,
    top: isHorizontal
      ? 0
      : event.key === 'ArrowDown'
        ? 190
        : -190,
    behavior: 'smooth',
  });
});

mediaToggle.addEventListener('click', () => {
  const isPlaying = mediaToggle.getAttribute('aria-pressed') === 'true';
  mediaToggle.setAttribute('aria-pressed', String(!isPlaying));
  mediaToggle.setAttribute('aria-label', isPlaying ? '음악 재생' : '음악 일시정지');
  mediaToggle.textContent = isPlaying ? '▶' : 'Ⅱ';
});

document.querySelectorAll('[data-map-zoom]').forEach((button) => {
  button.addEventListener('click', () => {
    const canvas = button.closest('.map-canvas');
    const apiMap = canvas.classList.contains('map-canvas--home')
      ? homeMap
      : navigationMap;

    if (apiMap) {
      const delta = button.dataset.mapZoom === 'in' ? -1 : 1;
      apiMap.setLevel(Math.min(10, Math.max(1, apiMap.getLevel() + delta)));
      return;
    }

    const currentScale =
      Number.parseFloat(canvas.style.getPropertyValue('--map-scale')) || 1;
    const delta = button.dataset.mapZoom === 'in' ? 0.08 : -0.08;
    const nextScale = Math.min(1.24, Math.max(0.84, currentScale + delta));

    canvas.style.setProperty('--map-scale', nextScale.toFixed(2));
  });
});

function getCurrentLocation() {
  if (!navigator.geolocation) {
    return Promise.resolve(fallbackLocation);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },
      () => resolve(fallbackLocation),
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 5_000,
      },
    );
  });
}

function loadKakaoMapsSdk(apiKey) {
  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(resolve));
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('#kakao-maps-sdk');

    if (existingScript) {
      existingScript.addEventListener(
        'load',
        () => window.kakao.maps.load(resolve),
        { once: true },
      );
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.src =
      `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(apiKey)}` +
      '&autoload=false&libraries=services';
    script.async = true;
    script.addEventListener(
      'load',
      () => window.kakao.maps.load(resolve),
      { once: true },
    );
    script.addEventListener('error', reject, { once: true });
    document.head.append(script);
  });
}

function updateLocationAddress(kakao, position) {
  kakaoGeocoder ??= new kakao.maps.services.Geocoder();

  kakaoGeocoder.coord2RegionCode(
    position.getLng(),
    position.getLat(),
    (result, status) => {
      if (status !== kakao.maps.services.Status.OK || !result[0]) {
        return;
      }

      const region = result.find((item) => item.region_type === 'H') ?? result[0];
      homeMapAddress.textContent = region.address_name;
    },
  );
}

function getPlaceAtMapPosition(position) {
  const latitude = position.getLat();
  const longitude = position.getLng();

  return new Promise((resolve) => {
    kakaoGeocoder.coord2Address(
      longitude,
      latitude,
      (result, status) => {
        const addressResult =
          status === kakaoMaps.maps.services.Status.OK ? result[0] : null;
        const roadAddress = addressResult?.road_address;
        const lotAddress = addressResult?.address;
        const address =
          roadAddress?.address_name ||
          lotAddress?.address_name ||
          `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        const name =
          roadAddress?.building_name?.trim() ||
          roadAddress?.address_name ||
          lotAddress?.address_name ||
          '지도에서 선택한 위치';

        resolve({
          name,
          address,
          category: '지도 선택',
          latitude,
          longitude,
        });
      },
    );
  });
}

function getWeatherSymbol(conditionId, timestamp) {
  if (conditionId >= 200 && conditionId < 300) {
    return '⚡';
  }

  if (conditionId >= 300 && conditionId < 600) {
    return '☂';
  }

  if (conditionId >= 600 && conditionId < 700) {
    return '❄';
  }

  if (conditionId >= 700 && conditionId < 800) {
    return '≋';
  }

  if (conditionId === 800) {
    const hour = new Date(
      (timestamp + weatherTimezoneOffset) * 1_000,
    ).getUTCHours();
    return hour >= 19 || hour < 6 ? '☾' : '☀';
  }

  return conditionId < 803 ? '◒' : '☁';
}

function getLocalizedCityName(cityName) {
  const knownCities = {
    Seoul: '서울',
    Incheon: '인천',
    Busan: '부산',
    Daegu: '대구',
    Daejeon: '대전',
    Gwangju: '광주',
    Ulsan: '울산',
  };

  return knownCities[cityName] ?? cityName ?? '현재 위치';
}

function formatWeatherTimestamp(timestamp, options) {
  return new Intl.DateTimeFormat('ko-KR', {
    ...options,
    timeZone: 'UTC',
  }).format(
    new Date((timestamp + weatherTimezoneOffset) * 1_000),
  );
}

function getWeatherDateKey(timestamp) {
  return new Date(
    (timestamp + weatherTimezoneOffset) * 1_000,
  )
    .toISOString()
    .slice(0, 10);
}

function createMiniForecastItem(item) {
  const container = document.createElement('span');
  const time = document.createElement('small');
  const temperature = document.createElement('b');

  time.textContent = formatWeatherTimestamp(item.dt, {
    hour: '2-digit',
    hour12: false,
  });
  temperature.textContent = `${Math.round(item.main.temp)}°`;
  container.append(time, temperature);

  return container;
}

function createForecastCard(item) {
  const card = document.createElement('article');
  const time = document.createElement('small');
  const icon = document.createElement('span');
  const temperature = document.createElement('strong');
  const details = document.createElement('dl');
  const humidityRow = document.createElement('div');
  const humidityLabel = document.createElement('dt');
  const humidityValue = document.createElement('dd');
  const windRow = document.createElement('div');
  const windLabel = document.createElement('dt');
  const windValue = document.createElement('dd');
  const weather = item.weather?.[0] ?? {};

  card.className = 'forecast-card';
  card.dataset.forecastTimestamp = String(item.dt);
  time.textContent = formatWeatherTimestamp(item.dt, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  icon.className = 'forecast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = getWeatherSymbol(weather.id, item.dt);
  temperature.textContent = `${Math.round(item.main.temp)}°`;
  humidityLabel.textContent = '습도';
  humidityValue.textContent = `${Math.round(item.main.humidity)}%`;
  windLabel.textContent = '바람';
  windValue.textContent = Number(item.wind?.speed ?? 0).toFixed(1);
  humidityRow.append(humidityLabel, humidityValue);
  windRow.append(windLabel, windValue);
  details.append(humidityRow, windRow);
  card.append(time, icon, temperature, details);

  return card;
}

function renderDailyOutlooks(entries, current) {
  const groupedEntries = new Map();

  entries.forEach((entry) => {
    const dateKey = getWeatherDateKey(entry.dt);
    const group = groupedEntries.get(dateKey) ?? [];
    group.push(entry);
    groupedEntries.set(dateKey, group);
  });

  const nowTimestamp = Number(current.dt) || Math.floor(Date.now() / 1_000);
  const todayKey = getWeatherDateKey(nowTimestamp);
  const tomorrowKey = getWeatherDateKey(nowTimestamp + 86_400);
  const summaries = [todayKey, tomorrowKey].map((dateKey, index) => {
    const items = groupedEntries.get(dateKey) ?? [];
    const temperatures = items
      .map((item) => Number(item.main.temp))
      .filter(Number.isFinite);

    if (index === 0) {
      [
        current.main.temp,
        current.main.temp_min,
        current.main.temp_max,
      ]
        .map(Number)
        .filter(Number.isFinite)
        .forEach((temperature) => temperatures.push(temperature));
    }

    if (!temperatures.length) {
      return null;
    }

    return {
      dateKey,
      timestamp: items[0]?.dt ?? nowTimestamp,
      minimum: Math.min(...temperatures),
      maximum: Math.max(...temperatures),
    };
  });
  const availableSummaries = summaries.filter(Boolean);
  const rangeMinimum = Math.min(
    ...availableSummaries.map((summary) => summary.minimum),
  );
  const rangeMaximum = Math.max(
    ...availableSummaries.map((summary) => summary.maximum),
  );
  const range = Math.max(1, rangeMaximum - rangeMinimum);

  dailyOutlooks.forEach((outlook, index) => {
    const summary = summaries[index];
    const row = outlook.label.closest('.daily-outlook');

    if (!summary) {
      row.hidden = true;
      return;
    }

    row.hidden = false;
    outlook.label.textContent = index === 0 ? '오늘' : '내일';
    outlook.minimum.textContent = `${Math.round(summary.minimum)}°`;
    outlook.maximum.textContent = `${Math.round(summary.maximum)}°`;
    outlook.track.style.setProperty(
      '--start',
      `${((summary.minimum - rangeMinimum) / range) * 74 + 8}%`,
    );
    outlook.track.style.setProperty(
      '--width',
      `${Math.max(12, ((summary.maximum - summary.minimum) / range) * 74)}%`,
    );
  });
}

function renderWeatherForecast(data) {
  const forecast = data.forecast;
  const entries = Array.isArray(forecast?.list)
    ? forecast.list.slice(0, 24)
    : [];
  const current = data.current;
  const hasThreeHourIntervals = entries.every(
    (entry, index) =>
      index === 0 || entry.dt - entries[index - 1].dt === 3 * 60 * 60,
  );

  if (
    entries.length < 24 ||
    !hasThreeHourIntervals ||
    !current?.main ||
    !current.weather?.[0]
  ) {
    throw new Error('Weather forecast is incomplete');
  }

  weatherTimezoneOffset = Number(
    forecast.city?.timezone ?? current.timezone ?? 0,
  );
  const weather = current.weather?.[0] ?? {};
  const cityName = getLocalizedCityName(
    current.name || forecast.city?.name,
  );
  const symbol = getWeatherSymbol(weather.id, current.dt);
  const temperature = Math.round(current.main.temp);
  const feelsLike = Math.round(current.main.feels_like);
  const description = weather.description || '날씨 정보';
  const visibilityKilometers = Number(current.visibility ?? 0) / 1_000;

  driveLocation.textContent = cityName;
  headerWeatherIcon.textContent = symbol;
  headerWeatherTemperature.textContent = `${temperature}°`;
  headerWeatherDescription.textContent = description;

  homeWeatherCity.textContent = cityName;
  homeWeatherIcon.textContent = symbol;
  homeWeatherTemperature.textContent = `${temperature}°`;
  homeWeatherDescription.textContent = description;
  homeWeatherFeelsLike.textContent = `체감 ${feelsLike}°`;
  homeMiniForecast.replaceChildren(
    ...entries.slice(0, 3).map(createMiniForecastItem),
  );

  weatherTitle.textContent = `${cityName}의 오늘`;
  weatherHeroIcon.dataset.symbol = symbol;
  weatherHeroIcon.classList.toggle('sun-visual--symbol', symbol !== '☀');
  weatherCurrentTemperature.textContent = String(temperature);
  weatherCurrentDescription.textContent = description;
  weatherCurrentFeelsLike.textContent = `체감온도 ${feelsLike}°`;
  weatherHumidity.textContent = `${Math.round(current.main.humidity)}%`;
  weatherWind.textContent = `${Number(current.wind?.speed ?? 0).toFixed(1)} m/s`;
  weatherPressure.textContent = `${Math.round(current.main.pressure)} hPa`;
  weatherVisibility.textContent = `${visibilityKilometers.toFixed(1)} km`;

  const precipitationProbability = Math.max(
    ...entries.slice(0, 8).map((item) => Number(item.pop ?? 0)),
  );
  drivingTipCopy.textContent =
    precipitationProbability >= 0.5
      ? '강수 가능성이 높습니다. 감속 운전과 충분한 안전거리를 유지하세요.'
      : '강수 가능성이 낮아 쾌적한 주행이 예상됩니다.';

  forecastCards.replaceChildren(...entries.map(createForecastCard));
  forecastCards.setAttribute(
    'aria-label',
    `3시간 간격 시간대별 예보 ${entries.length}개`,
  );
  forecastCards.scrollLeft = 0;
  renderDailyOutlooks(forecast.list, current);
}

async function requestWeatherForecast(location) {
  if (!window.axios) {
    document.documentElement.dataset.weatherConfiguration = 'unavailable';
    return;
  }

  latestWeatherLocation = location;
  const requestId = ++weatherRequestId;
  forecastCards.setAttribute('aria-busy', 'true');

  try {
    const response = await window.axios.get('/api/weather/forecast', {
      params: {
        lat: location.latitude,
        lon: location.longitude,
      },
    });

    if (requestId !== weatherRequestId) {
      return;
    }

    renderWeatherForecast(response.data);
    lastWeatherUpdateAt = Date.now();
    document.documentElement.dataset.weatherConfiguration = 'ready';
  } catch (error) {
    if (requestId !== weatherRequestId) {
      return;
    }

    const isMissingKey =
      error.response?.data?.error?.code === 'API_KEY_MISSING';
    const hasPreviousWeather = lastWeatherUpdateAt > 0;
    document.documentElement.dataset.weatherConfiguration = hasPreviousWeather
      ? 'stale'
      : isMissingKey
        ? 'missing'
        : 'error';
  } finally {
    if (requestId === weatherRequestId) {
      forecastCards.removeAttribute('aria-busy');
    }
  }
}

function refreshWeatherIfStale() {
  const refreshInterval = 10 * 60 * 1_000;

  if (
    latestWeatherLocation &&
    Date.now() - lastWeatherUpdateAt >= refreshInterval
  ) {
    requestWeatherForecast(latestWeatherLocation);
  }
}

async function initializeKakaoMap(apiKey, location) {
  await loadKakaoMapsSdk(apiKey);

  const kakao = window.kakao;
  kakaoMaps = kakao;
  const position = new kakao.maps.LatLng(
    location.latitude,
    location.longitude,
  );
  currentPosition = position;

  homeMap = new kakao.maps.Map(homeMapContainer, {
    center: position,
    level: 4,
  });
  navigationMap = new kakao.maps.Map(navigationMapContainer, {
    center: position,
    level: 5,
  });
  kakaoPlacesService = new kakao.maps.services.Places();
  kakaoGeocoder = new kakao.maps.services.Geocoder();

  kakao.maps.event.addListener(homeMap, 'rightclick', async (event) => {
    const requestId = ++mapSelectionRequestId;
    showHomeMapSelection(
      event.latLng,
      {
        name: '위치 확인 중…',
        address: '주소를 찾고 있습니다.',
      },
      { loading: true },
    );
    const place = await getPlaceAtMapPosition(event.latLng);

    if (requestId !== mapSelectionRequestId) {
      return;
    }

    showHomeMapSelection(event.latLng, place);
  });

  const markerContent = document.createElement('div');
  markerContent.className = 'api-current-marker';
  markerContent.setAttribute('aria-hidden', 'true');
  markerContent.innerHTML = '<span>▲</span>';

  new kakao.maps.CustomOverlay({
    map: homeMap,
    position,
    content: markerContent,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: 6,
  });

  const navigationMarkerContent = markerContent.cloneNode(true);
  new kakao.maps.CustomOverlay({
    map: navigationMap,
    position,
    content: navigationMarkerContent,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: 6,
  });

  homeMapContainer.parentElement.classList.add('map-canvas--api-ready');
  navigationMapContainer.parentElement.classList.add('map-canvas--api-ready');
  updateLocationAddress(kakao, position);
  scheduleMapRelayout();
}

async function loadRuntimeConfig() {
  if (!window.axios) {
    document.documentElement.dataset.mapConfiguration = 'unavailable';
    return null;
  }

  try {
    const response = await window.axios.get('/api/runtime-config');
    const hasMapKey = Boolean(response.data.kakaoMapJavascriptKey);
    document.documentElement.dataset.mapConfiguration = hasMapKey
      ? 'ready'
      : 'missing';
    return response.data;
  } catch {
    document.documentElement.dataset.mapConfiguration = 'unavailable';
    return null;
  }
}

async function initializeExternalApis() {
  const [config, location] = await Promise.all([
    loadRuntimeConfig(),
    getCurrentLocation(),
  ]);
  const mapTask = config?.kakaoMapJavascriptKey
    ? initializeKakaoMap(config.kakaoMapJavascriptKey, location).catch(() => {
        document.documentElement.dataset.mapConfiguration = 'error';
      })
    : Promise.resolve();

  await Promise.all([mapTask, requestWeatherForecast(location)]);
}

updateDateTime();
window.setInterval(updateDateTime, 30_000);
window.setInterval(refreshWeatherIfStale, 60_000);
window.addEventListener('resize', scheduleMapRelayout);
document.addEventListener('fullscreenchange', scheduleMapRelayout);
if ('ResizeObserver' in window) {
  mapResizeObserver = new ResizeObserver(scheduleMapRelayout);
  mapResizeObserver.observe(infotainmentScreen);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshWeatherIfStale();
  }
});
window.addEventListener('hashchange', () => {
  const name = location.hash.slice(1);
  setView(name === 'logs' ? 'settings' : Object.hasOwn(viewLabels, name) ? name : 'home');
});
setView(currentView);
renderRecentHistory();
// PJT2 submission scope: retain the PJT1 screens without connecting map/weather APIs.
// initializeExternalApis() is retained for a future configured PJT1 environment.
