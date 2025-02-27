import { MARKETS } from './markets.js';
import { fetchToken, fetchAlbumData, fetchTrackIds, fetchTracksData } from './api.js';

const input = document.querySelector('input');
const searchBtn = document.querySelector('#search-btn');
const message = document.querySelector('#message');
const albumContainer = document.querySelector('#album-container');

const token = await fetchToken();

input.value = localStorage.getItem('inputValue');
albumContainer.innerHTML = localStorage.getItem('albumContainer');
searchBtn.addEventListener('click', handleClick);

async function handleClick() {
  searchBtn.disabled = true;
  message.textContent = 'Loading...';
  albumContainer.innerHTML = '';

  const inputValue = input.value.trim().split('?')[0].split('#')[0];

  try {
    const albumId = extractAlbumId(inputValue);
    const albumData = await fetchAlbumData(albumId, token);
    const trackIds = await fetchTrackIds(albumData, token);
    const tracksData = await fetchTracksData(trackIds, token);
    buildAlbum(albumData, tracksData);

    message.textContent = '';
    localStorage.setItem('inputValue', inputValue);
    localStorage.setItem('albumContainer', albumContainer.innerHTML);
  } catch (error) {
    console.error(error);
    message.textContent = error;
  } finally {
    searchBtn.disabled = false;
  }
}

function extractAlbumId(inputValue) {
  // ID only
  if (inputValue.match(/^[a-zA-Z0-9]{22}$/)) return inputValue;

  // full URL
  const match = inputValue.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]{22})/);
  if (match) return match[1];

  throw new Error('Invalid album ID');
}

function buildAlbum(albumData, tracksData) {
  // cover
  const cover = document.createElement('img');
  cover.classList.add('cover-img');
  cover.src = albumData.images[0].url;
  cover.alt = 'Cover';

  // cover link (up to 2000px)
  const coverLink = document.createElement('a');
  coverLink.href = albumData.images[0].url.replace('ab67616d0000b273', 'ab67616d000082c1');
  coverLink.target = '_blank';
  coverLink.append(cover);

  // album type
  const albumType = document.createElement('h3');
  albumType.classList.add('album-type');
  albumType.textContent = albumData.album_type;

  // album name
  const albumName = document.createElement('h2');
  albumName.classList.add('album-name');
  albumName.innerHTML = `<a href="${albumData.external_urls.spotify}" target="_blank">${albumData.name}</a>`;

  // album artist
  const albumArtist = document.createElement('h3');
  albumArtist.innerHTML =
    'by ' +
    albumData.artists
      .map((artist) => {
        return `<a href="${artist.external_urls.spotify}" target="_blank">${artist.name}</a>`;
      })
      .join(', ');

  // release date
  const releaseDate = document.createElement('p');
  releaseDate.classList.add('release-date');
  releaseDate.textContent = albumData.release_date;

  // total tracks
  const totalTracks = document.createElement('p');
  totalTracks.textContent = 'Tracks: ' + albumData.total_tracks;

  // MusicBrainz lookup
  const mbLookup = document.createElement('a');
  mbLookup.href = `https://musicbrainz.org/search?query=barcode%3A${albumData.external_ids.upc}&type=release&limit=25&method=advanced`;
  mbLookup.target = '_blank';
  mbLookup.innerHTML = `<img src="./icons/MusicBrainz_Logo_(2016).svg" title="Search on MusicBrainz" class="musicbrainz-logo" />`;

  // upc
  const upc = document.createElement('p');
  upc.textContent = 'UPC: ' + albumData.external_ids.upc; // may be undefined
  if (albumData.external_ids.upc) upc.append(mbLookup);
  else upc.classList.add('unavailable');

  // label
  const label = document.createElement('p');
  label.textContent = 'Label: ' + albumData.label;

  // tracks table
  const tracksTable = document.createElement('table');
  const thead = tracksTable.createTHead();
  const tbody = tracksTable.createTBody();
  const row = thead.insertRow();
  const headers = [
    '#',
    'TITLE',
    'ARTIST',
    'ISRC',
    '<img src="./icons/clock.svg" class="clock-icon" />',
  ];
  headers.forEach((text) => {
    const th = document.createElement('th');
    th.innerHTML = text;
    row.append(th);
  });

  // tracks
  let isAlbumExplicit = false;
  let discNumber = 1;
  let trackIndex = 1;
  let totalLength = 0;

  for (const track of tracksData) {
    // insert disc number row if it's a new disc
    if (track.disc_number !== discNumber) {
      discNumber = track.disc_number;
      trackIndex = 1; // reset track count

      const td = document.createElement('td');
      td.classList.add('disc-number');
      td.colSpan = 5;
      td.textContent = `Disc ${discNumber}`;

      tbody.insertRow().append(td);
    }

    // track number
    const trackNumber = document.createElement('td');
    trackNumber.textContent = (trackIndex++).toString();

    // track name
    const trackName = document.createElement('td');
    trackName.innerHTML = `<a href="${track.external_urls.spotify}" target="_blank">${track.name}</a>`;

    // add explicit icon
    if (track.explicit) {
      trackName.innerHTML += '<img src="./icons/explicit.svg" class="explicit-icon" />';
      isAlbumExplicit = true; // if at least one track is explicit, then the entire album is considered explicit
    }

    // track artist
    const trackArtist = document.createElement('td');
    trackArtist.innerHTML = track.artists
      .map((artist) => {
        return `<a href="${artist.external_urls.spotify}" target="_blank">${artist.name}</a>`;
      })
      .join(', ');

    // track isrc
    const trackIsrc = document.createElement('td');
    if (track.external_ids.isrc) {
      const isrc = track.external_ids.isrc.toUpperCase();
      trackIsrc.innerHTML = `<a href="https://open.spotify.com/search/isrc%3A${isrc}/tracks" target="_blank">${isrc}</a>`;
    } else {
      trackIsrc.classList.add('unavailable');
      trackIsrc.textContent = 'undefined';
    }

    // track length
    const trackLength = document.createElement('td');
    trackLength.textContent = millisecondsToTime(track.duration_ms);
    totalLength += track.duration_ms;

    tbody.insertRow().append(trackNumber, trackName, trackArtist, trackIsrc, trackLength);
  }

  // add album explicit icon
  if (isAlbumExplicit)
    albumName.innerHTML += '<img src="./icons/explicit.svg" class="album-explicit-icon" />';

  // total length
  totalTracks.textContent += `, Length: ${millisecondsToTime(totalLength)}`;

  // copyrights
  const copyrights = document.createElement('div');
  copyrights.classList.add('copyrights');

  for (const copyright of albumData.copyrights) {
    const copyrightType = document.createElement('p');
    const cleanText = copyright.text.replace(/©|\(C\)|℗|\(P\)/, '').trim();

    if (copyright.type?.toUpperCase() === 'C') copyrightType.textContent = '© ' + cleanText;
    else if (copyright.type?.toUpperCase() === 'P') copyrightType.textContent = '℗ ' + cleanText;

    copyrights.append(copyrightType);
  }

  // album availability section
  const albumAvailability = document.createElement('div');
  albumAvailability.classList.add('album-availability');

  const availabilityTitle = document.createElement('h3');
  availabilityTitle.classList.add('availability-title');
  availabilityTitle.textContent = 'Album Availability';

  const availableMarketsElem = document.createElement('p');
  const unavailableMarketsElem = document.createElement('p');
  albumAvailability.append(availabilityTitle, availableMarketsElem, unavailableMarketsElem);

  const availableMarkets = albumData.available_markets.sort();
  const unavailableMarkets = MARKETS.filter((market) => !availableMarkets.includes(market));

  if (availableMarkets.length === 0) {
    availableMarketsElem.classList.add('unavailable');
    availableMarketsElem.textContent = 'This album is no longer available :(';
  } else if (unavailableMarkets.length === 0) {
    availableMarketsElem.classList.add('available');
    availableMarketsElem.textContent = 'This album is available everywhere :)';
  } else {
    availableMarketsElem.innerHTML = `Available in (${
      availableMarkets.length
    }):<span class="markets">${availableMarkets.join(', ')}</span>`;

    unavailableMarketsElem.innerHTML = `Unavailable in (${
      unavailableMarkets.length
    }):<span class="markets">${unavailableMarkets.join(', ')}</span>`;
  }

  // append elements
  const albumInfo = document.createElement('div');
  albumInfo.append(albumType, albumName, albumArtist, releaseDate, totalTracks, upc, label);

  const coverInfoContainer = document.createElement('div');
  coverInfoContainer.classList.add('cover-info-container');
  coverInfoContainer.append(coverLink, albumInfo);

  albumContainer.append(coverInfoContainer, tracksTable, copyrights, albumAvailability);
}

function millisecondsToTime(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');

  if (formattedHours === '00') {
    return `${formattedMinutes}:${formattedSeconds}`;
  } else {
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }
}
