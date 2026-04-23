const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.rating,places.userRatingCount,nextPageToken';

async function fetchPage(apiKey: string, textQuery: string, pageToken?: string) {
  const body: any = { textQuery, languageCode: 'es' };
  if (pageToken) body.pageToken = pageToken;

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Google Places API Error: ${response.status} - ${JSON.stringify(errBody)}`);
  }

  return response.json();
}

function mapPlace(place: any) {
  return {
    google_place_id: place.id,
    nombre: place.displayName?.text,
    direccion: place.formattedAddress,
    telefono: place.nationalPhoneNumber || '',
    sitio_web: place.websiteUri || '',
    fuente: 'google_places',
    confianza_fuente: 'alta',
    _rating: place.rating,
    _userRatingCount: place.userRatingCount,
  };
}

export async function searchGooglePlaces(nicho: string, ciudad: string, maxPages = 3) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('No GOOGLE_PLACES_API_KEY configured');

  const query = `${nicho} en ${ciudad}`;
  const results: any[] = [];
  const pages = Math.min(Math.max(1, maxPages), 3);

  let pageToken: string | undefined;
  for (let page = 0; page < pages; page++) {
    const data = await fetchPage(apiKey, query, pageToken);
    const places = (data.places || []).filter((p: any) => p.businessStatus === 'OPERATIONAL');
    results.push(...places.map(mapPlace));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
    if (page < pages - 1) await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}
