/**
 * dom storage adapter 
 * === 
 * - originally authored by Joseph Pecoraro
 *
 */
//
// TODO does it make sense to be chainable all over the place?
// chainable: nuke, remove, all, get, save, all
// not chainable: valid, keys
//
Lawnchair.adapter('dom', (function() {
    var storage = window.localStorage;

    // the indexer is an encapsulation of the helpers needed to keep an ordered index of the keys
    var indexer = function(name) {
        return {
            // the key
            key: name + '._index_',
            // returns the index
            all: function() {
                var a = JSON.parse(storage.getItem(this.key));
                if (a === null) storage.setItem(this.key, JSON.stringify([]));
                // lazy init
                return JSON.parse(storage.getItem(this.key));
            },
            // adds a key to the index
            add: function(key) {
                var a = this.all();
                a.push(key);
                this.reIndex(a);
            },
            // deletes a key from the index
            del: function(key) {
                var idx = this.find(key);
                if (idx < 0) return

                var a = this.all();
                a.splice(idx, 1);
                this.reIndex(a);
            },
            // returns index for a key
            find: function(key) {
                return this.all().indexOf(key);
            },
            // reIndex based on new keys
            reIndex: function(a) {
                storage.setItem(this.key, JSON.stringify(a));
            }
        };
    };

    var keyWithPrefix = function(key) {
        return this.name + '.' + key;
    };

    // adapter api
    return {

        // ensure we are in an env with localStorage
        valid: function() {
            return !! storage;
        },

        init: function(options, callback) {
            this.indexer = indexer(this.name);
            this.keyWithPrefix = keyWithPrefix;
            if (callback) this.fn(this.name, callback).call(this, this);
        },

        save: function(obj, callback) {
            var origKey = obj.key ? obj.key: this.uuid();
            var key = this.keyWithPrefix(origKey);
            // if the key is not in the index push it on
            if (this.indexer.find(key) < 0) this.indexer.add(key);
            // now we kill the key and use it in the store colleciton
            delete obj.key;
            storage.setItem(key, JSON.stringify(obj));
            obj.key = origKey;
            if (callback) {
                this.lambda(callback).call(this, obj);
            }
            return this;
        },

        batch: function(ary, callback) {
            var saved = [];
            // not particularily efficient but this is more for sqlite situations
            for (var i = 0, l = ary.length; i < l; i++) {
                this.save(ary[i],
                function(r) {
                    saved.push(r);
                });
            }
            if (callback) this.lambda(callback).call(this, saved);
            return this;
        },

        // accepts [options], callback
        keys: function(callback) {
            if (callback) {
                var name = this.name;
                var keys = this.indexer.all().map(function(r) {
                    return r.replace(name + '.', '')
                });
                this.fn('keys', callback).call(this, keys);
            }
            return this;
            // TODO options for limit/offset, return promise
        },

        get: function(keyOrArray, callback) {
            var keys = this.isArray(keyOrArray) ? keyOrArray: [keyOrArray];
            var r = []
            for (var i = 0, l = keys.length; i < l; i++) {
                var k = this.keyWithPrefix(keys[i]);
                var obj = JSON.parse(storage.getItem(k));
                if (obj){
                    obj.key = keys[i];
                    r.push(obj);
                }
            }
            var callbackParam = (r.length == 0) ? null : (r.length == 1 ? r[0] : r);
            if (callback) this.lambda(callback).call(this, callbackParam);
            return this;
        },
        // NOTE adapters cannot set this.__results but plugins do
        // this probably should be reviewed
        all: function(callback) {
            var idx = this.indexer.all();
            var r = [];
            var o;
            var k;
            for (var i = 0, l = idx.length; i < l; i++) {
                k = idx[i];
                o = JSON.parse(storage.getItem(k));
                o.key = k.replace(this.name + '.', '');
                r.push(o);
            }
            if (callback) this.fn(this.name, callback).call(this, r);
            return this;
        },

        remove: function(keyOrArray, callback) {
            var keys = this.isArray(keyOrArray) ? keyOrArray: [keyOrArray];
            var k;
            for (var i = 0, l = keys.length; i < l; i++) {
                k = this.keyWithPrefix(keys[i]);
                this.indexer.del(k);
                storage.removeItem(k);
            }
            if (callback) this.lambda(callback).call(this);
            return this;
        },

        exists: function(key, callback) {
            var exists = !!storage.getItem(this.keyWithPrefix(key));
            this.lambda(callback).call(this, exists);
            return this;
        },

        nuke: function(callback) {
            this.keys(function(theKeys) {
                this.remove(theKeys);
            });
            if (callback) this.lambda(callback).call(this);
            return this;
        }
    }
})());
