const apiKey =
  (typeof process !== 'undefined' && process.env ? process.env['GOOGLE_API_KEY'] : '') ||
  'AIzaSyCbQSruKkA_KszIultQb2gpTNFUwnnyazE';

export const environment = {
  production: true,
  googleApiKey: apiKey,
  apiUrl: 'https://control-gastos-api-io57eybm3q-tl.a.run.app/api',
  sseUrl: 'https://control-gastos-api-io57eybm3q-tl.a.run.app/api/events/sub',
  turnstileSiteKey: '0x4AAAAAAFJxWCo26CCsf8A2'
};
