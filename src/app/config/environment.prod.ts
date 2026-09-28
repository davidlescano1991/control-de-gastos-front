const apiKey = process.env['GOOGLE_API_KEY'] || '';
if (!apiKey) {
  console.warn('⚠️ GOOGLE_API_KEY environment variable is not set. Google Sheets integration will not work.');
}

export const environment = {
  production: true,
  googleApiKey: apiKey,
  apiUrl: 'https://control-gastos-api-io57eybm3q-tl.a.run.app/api',
  sseUrl: 'https://control-gastos-api-io57eybm3q-tl.a.run.app/api/events/sub'
};
