import { setCookie } from './cookies.js';

export async function fetchToken() {
  const proxies = ['https://api.allorigins.win/raw?url=', 'https://api.cors.lol/?url='];

  for (const proxy of proxies) {
    try {
      const res = await fetch(
        proxy + encodeURIComponent('https://open.spotify.com/get_access_token')
      );
      if (!res.ok) throw new Error(`Status: ${res.status}`);

      const data = await res.json();
      console.log(data);

      setCookie('token', data.accessToken, data.accessTokenExpirationTimestampMs);
      return data.accessToken;
    } catch (error) {
      console.error(`Fetch failed with proxy: ${proxy}`, error);
    }
  }

  return null;
}

export async function fetchAlbumData(albumId, token) {
  const url = `https://api.spotify.com/v1/albums/${albumId}?access_token=${token}`;
  console.log(url);

  const res = await fetch(url);
  const data = await res.json();

  if (res.status === 200) return data;

  let errorMessage = `${data.error?.message} (${data.error?.status})`;
  if (data.error?.status === 401) errorMessage += '. Please refresh the page';
  if (data.error?.status === 404) errorMessage += '. Invalid album ID';
  throw new Error(errorMessage);
}

export async function fetchTrackIds(albumData, token) {
  let trackIds = albumData.tracks.items.map((track) => track.id); // up to 50 tracks
  let nextUrl = albumData.tracks.next; // exists if there are more than 50 tracks

  const fetchMoreTracks = async (url) => {
    const res = await fetch(`${url}&access_token=${token}`);
    if (res.status === 200) return await res.json();
    throw new Error(`Failed to fetch more tracks (${res.status})`);
  };

  while (nextUrl) {
    const data = await fetchMoreTracks(nextUrl);
    if (!data) break;
    trackIds.push(...data.items.map((track) => track.id));
    nextUrl = data.next;
  }

  return trackIds;
}

export async function fetchTracksData(trackIds, token) {
  let tracksData = [];

  // max 50 track ids per request, we have to split them if there are more
  const idsParamArr = idsToParam(trackIds, 50);

  for (const idsParam of idsParamArr) {
    const res = await fetch(
      `https://api.spotify.com/v1/tracks?ids=${idsParam}&access_token=${token}`
    );
    const data = await res.json();
    tracksData.push(...data.tracks);
  }

  console.log(tracksData);
  return tracksData;
}

function idsToParam(ids, limit) {
  const groupedIds = [];

  for (let i = 0; i < ids.length; i += limit) {
    const chunk = ids.slice(i, i + limit);
    groupedIds.push(chunk.join(','));
  }

  return groupedIds;
}
