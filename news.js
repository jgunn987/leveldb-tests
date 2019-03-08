const apiKey = '26b1bf78fb08425c817001de09205aa7';
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(apiKey);

/*
newsapi.v2.topHeadlines({
  //sources: 'bbc-news,the-verge',
  q: 'bitcoin',
  category: 'business',
  language: 'en',
  country: 'us'
}).then(response => {
  console.log(response);
});
*/
/*
newsapi.v2.everything({
  q: 'bitcoin',
  language: 'en'
}).then(response => {
  console.log(response);
  console.log(response.articles[0]);
});
*/

newsapi.v2.sources({
  category: 'technology',
  language: 'en',
}).then(response =>
  response.sources.map(source => source.id))
.then(sources =>
  newsapi.v2.topHeadlines({
    sources: sources.join(','),
    pageSize: 100
  }))
.then(response =>
  response.articles.map(article =>
    article.source.name + ':' +
    article.title).forEach(article => console.log(article)));

