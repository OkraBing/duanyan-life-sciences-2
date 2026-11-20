// Browser regression tests never send credentials or prompts to live services.
// Install before navigation; explicitly registered test routes can fulfill mocks.
async function blockExternalNetwork(page) {
  const modelRequests=[];
  await page.route(/^https?:\/\//, async route=>{
    const url=new URL(route.request().url());
    if(/\/api\/model\/chat|\/chat\/completions/.test(url.pathname))
      modelRequests.push(url.origin+url.pathname);
    await route.abort('blockedbyclient');
  });
  return modelRequests;
}
module.exports={blockExternalNetwork};
