Package.describe({
  name: 'jimmiebtlr:subs-cache',
  summary: 'A package for caching Meteor subscriptions.',
  version: '0.2.0',
  git: 'https://github.com/jimmiebtlr/meteor-subs-cache'
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1.3.1');

  api.use([
    'ecmascript',
    'underscore',
    'ejson',
    'tracker',
    'reactive-var'
  ], ['client', 'server']);

  api.mainModule('subsCache.js');
});
