var callbacksFromArgs, debug, hasCallbacks, withoutCallbacks,
  slice = [].slice;

debug = function() {
  var args;
  args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
};

hasCallbacks = function(args) {
  var lastArg;
  if (args.length) {
    lastArg = args[args.length - 1];
    return _.isFunction(lastArg) || (lastArg && _.any([lastArg.onReady, lastArg.onError, lastArg.onStop], _.isFunction));
  }
};

withoutCallbacks = function(args) {
  if (hasCallbacks(args)) {
    return args.slice(0);
  } else {
    return args.slice(0);
  }
};

callbacksFromArgs = function(args) {
  if (hasCallbacks(args)) {
    if (_.isFunction(args[args.length - 1])) {
      return {
        onReady: args[args.length - 1]
      };
    } else {
      return args[args.length - 1];
    }
  } else {
    return {};
  }
};

const SubsCache = (function() {
  SubsCache.caches = [];

  function SubsCache(obj) {
    var cacheLimit, expireAfter;
    expireAfter = void 0;
    cacheLimit = void 0;
    if (obj) {
      expireAfter = obj.expireAfter, cacheLimit = obj.cacheLimit;
    }
    if (expireAfter === void 0) {
      expireAfter = 5;
    }
    if (cacheLimit === void 0) {
      cacheLimit = 10;
    }
    if (cacheLimit === 0) {
      console.warn("cacheLimit cannot be zero!");
      cacheLimit = 1;
    }
    this.expireAfter = expireAfter;
    this.cacheLimit = cacheLimit;
    this.cache = {};
    this.allReady = new ReactiveVar(true);
    SubsCache.caches.push(this);
  }

  SubsCache.prototype.ready = function() {
    return this.allReady.get();
  };

  SubsCache.prototype.onReady = function(callback) {
    return Tracker.autorun((function(_this) {
      return function(c) {
        if (_this.ready()) {
          c.stop();
          return callback();
        }
      };
    })(this));
  };

  SubsCache.clearAll = function() {
    return this.caches.map(function(s) {
      return s.clear();
    });
  };

  SubsCache.prototype.clear = function() {
    return _.values(this.cache).map(function(sub) {
      return sub.stopNow();
    });
  };

  SubsCache.prototype.subscribe = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    args.unshift(this.expireAfter);
    return this.subscribeFor.apply(this, args);
  };

  SubsCache.prototype.subscribeFor = function() {
    var allSubs, args, cache, cachedSub, expireTime, hash, i, j, needToDelete, newArgs, numSubs, ref, ref1;
    expireTime = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    if (Meteor.isServer) {
      return Meteor.subscribe.apply(Meteor.args);
    } else {
      hash = EJSON.stringify(withoutCallbacks(args));
      cache = this.cache;
      if (hash in cache) {
        if (hasCallbacks(args)) {
          cache[hash].addHooks(callbacksFromArgs(args));
        }
        cache[hash].restart();
      } else {
        cachedSub = {
          sub: null,
          hash: hash,
          compsCount: 0,
          timerId: null,
          expireTime: expireTime,
          when: null,
          hooks: [],
          ready: function() {
            return this.sub.ready();
          },
          onReady: function(callback) {
            if (this.ready()) {
              return Tracker.nonreactive(function() {
                return callback();
              });
            } else {
              return Tracker.autorun((function(_this) {
                return function(c) {
                  if (_this.ready()) {
                    c.stop();
                    return Tracker.nonreactive(function() {
                      return callback();
                    });
                  }
                };
              })(this));
            }
          },
          addHooks: function(callbacks) {
            if (_.isFunction(callbacks.onReady)) {
              this.onReady(callbacks.onReady);
              delete callbacks.onReady;
            }
            return this.hooks.push(callbacks);
          },
          makeCallHooksFn: function(hookName) {
            cachedSub = this;
            return function() {
              var originalArgs, originalThis;
              originalThis = this;
              originalArgs = arguments;
              return _.each(cachedSub.hooks, function(hookDict) {
                if (_.isFunction(hookDict[hookName])) {
                  return hookDict[hookName].apply(originalThis, originalArgs);
                }
              });
            };
          },
          start: function() {
            var c;
            this.when = Date.now();
            this.compsCount += 1;
            c = Tracker.currentComputation;
            return c != null ? c.onInvalidate((function(_this) {
              return function() {
                return _this.delayedStop();
              };
            })(this)) : void 0;
          },
          stop: function() {
            return this.delayedStop();
          },
          delayedStop: function() {
            if (expireTime >= 0) {
              return this.timerId = setTimeout(this.stopNow.bind(this), expireTime * 1000 * 60);
            }
          },
          restart: function() {
            clearTimeout(this.timerId);
            return this.start();
          },
          stopNow: function() {
            this.compsCount -= 1;
            if (this.compsCount <= 0) {
              this.sub.stop();
              return delete cache[this.hash];
            }
          }
        };
        newArgs = withoutCallbacks(args);
        newArgs.push({
          onError: cachedSub.makeCallHooksFn('onError'),
          onStop: cachedSub.makeCallHooksFn('onStop')
        });
        cachedSub.sub = Tracker.nonreactive(function() {
          return Meteor.subscribe.apply(Meteor, newArgs);
        });
        if (hasCallbacks(args)) {
          cachedSub.addHooks(callbacksFromArgs(args));
        }
        if (this.cacheLimit > 0) {
          allSubs = _.sortBy(_.values(cache), function(x) {
            return x.when;
          });
          numSubs = allSubs.length;
          if (numSubs >= this.cacheLimit) {
            needToDelete = numSubs - this.cacheLimit + 1;
            for (i = j = 0, ref = needToDelete; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
              debug("overflow", allSubs[i]);
              allSubs[i].stopNow();
            }
          }
        }
        cache[hash] = cachedSub;
        cachedSub.start();
        if ((ref1 = this.allReadyComp) != null) {
          ref1.stop();
        }
        Tracker.autorun((function(_this) {
          return function(c) {
            var subs;
            _this.allReadyComp = c;
            subs = _.values(_this.cache);
            if (subs.length > 0) {
              return _this.allReady.set(subs.map(function(x) {
                return x.ready();
              }).reduce(function(a, b) {
                return a && b;
              }));
            }
          };
        })(this));
      }
      return cache[hash];
    }
  };

  return SubsCache;

})();

export default SubsCache;

// ---
// generated by coffee-script 1.9.2
