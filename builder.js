Environment = {
  meta: {},  //contains page meta attributes
  params: {//global hash of current params
    version: Math.round(Math.random() * 50000)
  },
  config: {//frontend configuration. see frontend.yml
    path: "/javascripts",
    index: "/javascripts/build.json",
    autoload: true,
    cache: true,
    pack: true,
    verbosity: 3,
    subdomain: false,
    hosts: 1,
    name: "artificial"
  },
  things: {} //contains some important widget instances for easy debug
};


(function () {
  
  //essential functions 
  var $empty = function(){};

  var JSON = {
    parse: function (text) {
      return eval('(' + text + ')');
    }
  };

  var extend = function(one, another) {
    for (var i in another) one[i] = another[i];
    return one;
  }

  //extract meta-params from head
  for (var i = 0, nodes = document.getElementsByTagName('head')[0].getElementsByTagName('meta'), node; node = nodes[i++];) {
    switch(node.getAttribute('rel')) {
      case "param":
        Environment.params[node.name] = node.content;
        break;

      case "config":
        extend(Environment.config, JSON.parse(node.content));
        break;

      default:
        Environment.meta[node.name || node['http-equiv']] = node.content;
    } 
  }
  
  //Add console fallbacks
  if (!window.console) window.console = {};
  for (var methods = ['info', 'warn', 'profile', 'group', 'profileEnd', 'groupCollapsed', 'groupEnd', 'error'], i = 0, method; method = methods[i]; i++) {
    if (!console[method] || !console[method].apply) console[method] = $empty;
  }



  console.groupCollapsed('Loading ' + Environment.config.name.toUpperCase() + ' environment...');
  // more of mootools emulation
  var $flatten = function (ary) {
    var flat = [];
    for (var i = 0, j = ary.length; i < j; i++) {
      flat = flat.concat((ary[i] && (ary[i].push || ary[i].callee)) ? $flatten(ary[i]) : ary[i]);
    }
    return flat;
  };

  var $splat = function () {
    return $flatten(arguments);
  };  
  
  var bind = function(fn, subj) {
    return function() {
      return fn.apply(subj, arguments);
    }
  }

  var Request = function (url, onComplete) {
    this.transport = this.getTransport();
    this.onComplete = onComplete;
    this.request(url);
  };

  Request.prototype = {
    request: function (url) {
      this.transport.open("get", url, true);
      var self = this;
      this.transport.onreadystatechange = function () { self.onStateChange.apply(self, arguments); };
      this.transport.send(null);
    },

    getTransport: function () {
      if (window.XMLHttpRequest) return new XMLHttpRequest();
      else if (window.ActiveXObject) return new ActiveXObject('MSXML2.XMLHTTP');
      else return false;
    },

    onStateChange: function () {
      if (this.transport.readyState == 4 && this.transport.status == 200) {
        var self = this;
        if (this.onComplete) setTimeout(function () {self.onComplete(self.transport);}, 10);
        this.transport.onreadystatechange = function () {};
      }
    }
  };




  var DOMReady = function(func){
    var already = false;

    ready = function () {
      if (!already) {
        func();
        already = true;
      }
    };
    try {//opera, firefox
      document.addEventListener("DOMContentLoaded", ready, false);
    } 
    catch (e) { //ie
      timer = setInterval(function(){
        if (/loaded|complete/.test(document.readyState)) {
          clearInterval(timer);
          ready();
        }
      }, 20);
    }


    window.onload = function(){
      ready();
    };
  };
  
  var Attachment = function(name) {
    this.name = name;
    this.load(name);
  };
  
  Attachment.prototype = {
    load: function(name) {
      if (Environment.config.attach) this.inject(this.getNode())
    },
    
    getAttributes: function() {
      var ua = navigator.userAgent;
      var attrs = {tag: 'link', rel: 'Stylesheet', href: "/stylesheets/" + this.name + ".uri.css"}
      //IE8 + Non-IE
      if (!window.ActiveXObject || /MSIE 8./i.test(ua)) {
        attrs.href = "/stylesheets/" + this.name + ".css";
      } else {
        //IE7 on vista doesnt support MHT embedding.
        //MHT throws out security warning when is used with SSL
        if (!/NT 6.0/i.test(ua) && location.protocol != 'https:' && (Environment.config.mht != false)) {
          attrs = {
            tag: 'script',
            defer: 'defer',
            type: 'text/javascript',
            src: "/javascripts/" + this.name + ".mht.js"
          };
        }
      }
      return attrs;
    },
    
    getNode: function(name) {
      var attrs = this.getAttributes();
      var tag = attrs.tag
      delete attrs.tag

      if (attrs.src) attrs.src = DM.format(attrs.src);
      if (attrs.href) attrs.href = DM.format(attrs.href);

      var node = document.createElement(tag);
      for (var i in attrs) node[i] = attrs[i];
  
       return node;
    },
    
    inject: function(node) {
      document.getElementsByTagName('head')[0].appendChild(node);
    }
  }

  new DOMReady(function () {
    if (!window.Browser) Browser = {};
    if (!Browser.loaded && window.fireEvent) window.fireEvent('domready');

    new Attachment('images');

    Browser.loaded = true;
  });

  (function() {
    var log = function(type) {
      var args = arguments;
      if (type == "log" || type == "info" || type == "error" || type == "warn") {
        var sliced = [];
        for (var i = 1, j = arguments.length; i < j; i++) sliced.push(arguments[i]);
        args = sliced;
      }
      if (console[type] && console[type].apply) console[type].apply(console, args);
    }
    
    var vlog = function(level) {
      return Environment.config.verbosity >= level ? log : $empty;
    }
    
    var trim = function(string, symbol) {
      return string.replace(/^\/|\/$/g, '');
      
      if (!symbol) symbol = "/";
      var from = 0;
      var to = string.length;
      while (string[from] == symbol) from ++;
      while (string[to - 1] == symbol) to --;
      if (from == 0 && to == string.length) return string;
      
      return string.substr(from, to - from);  
    }

    DM = DependencyManager = function(doc) {
      this.document = doc || document;
      this.head = this.document.getElementsByTagName('head')[0];
      
      this.paths = {};
      this.deps = {};
                  
      if (!DM.instance) {
        DM.stack = [];
        DM.instance = this;
      }
                  
      return this;
    };
    
    DM.Repository = function(object, prefix) {
      this.files = {};
      this.folders = {};
      this.paths = {};
    
      if (object && object.indexOf) object = JSON.parse(object);
      
      this.prefix = prefix ? trim(prefix) : '';
      this.register(object);
      
      return this;
    };
    
    DM.Folder = function(data, path) {
      this.files = [];
      this.path = path;
    };
    DM.Folder.prototype = {
      
      setParent: function(parent) {
        this.parent = parent;
      },
      
      getParent: function(parent) {
        return this.parent || this.repository;
      },
      
      setRepository: function(repository) {
        this.repository = repository;
        return this;
      },
      
      add: function(file) {
        this.files.push(file);
      }
    }
    
    //statuses
    //0 idle
    //1 loading
    //2 loaded
    
    DM.File = function(data, path) {
      this.deps = [];
      this.paths = [];
      
      this.setData(data);
      this.path = trim(path || this.getPath());
    };
    
    DM.File.getPath = function(node, name, prefix) {
      if (node.real) {
        name = node.real;
        prefix = DM.path;
      } else if (!prefix) {
        prefix = '';
      }
      return prefix + '/' + name;
    }
    
    DM.Script = function(file, manager) {
      this.state = 0;
      this.file = file;
      this.manager = manager;    
      if (manager) this.deps = manager.getDependencies(this.file);
      this.stack = [];    
    }
    
    DM.Script.prototype = {
      
      chain: function(callback) {
        this.stack.push(callback);
      },
      
      start: function() {
        this.onStateChanged();
        this.next();
      },
      
      next: function() {
        if (!this.deps.length) return this.load();
        var next = this.file.resolve(this.deps.shift());
        if (!next) return this.next();
        next.use(this.manager, bind(this.next, this));
      },
      
      load: function() {
        return this.manager.include(this.format(this.file.getURL()), bind(this.onLoad, this));
      },
      
      needsTagging: function() {
        return true;
      },
      
      format: function(path) {
        return this.tag(DM.staticFileURL(path));
      },
      
      tag: function(path) {
        return (this.needsTagging() && this.getTag()) ? path + "?" + this.getTag() : path;
      },

      getTag: function() {
        return Environment.params.version;
      },
      
      onLoad: function() {
        this.log();
        this.onStateChanged();
        var fn;
        while (fn = this.stack.shift()) fn();
      },

      isLoaded: function() {
        return this.state == 2;
      },

      isLoading: function() {
        return this.state == 1
      },

      isIdle: function() {
        return this.state == 0;
      },

      onStateChanged: function() {
        return this.state ++;
      },

      log: function() {
        vlog(1)("info", 'Loaded', '[' + this.file.name + ']', '[' + this.file.desc + ']', this.manager.document == document ? "" : "[iframe]")
      },
      
      use: function(callback) {
        if (callback) {
          if (this.isLoaded()) return callback();
          this.chain(callback);
        }
        if (this.isIdle()) this.start();
        return this;
      }
    };
    
    DM.File.prototype = {
      
      setData: function(node) {
        this.desc = node.desc;
        this.rule = node.rule;
        this.also = node.also;
        if (node.deps) {
          for (var i = 0, j = node.deps.length; i < j; i++) this.addDependency(node.deps[i])
        }
      },
      
      addDependency: function(file) {
        this.deps.push(file);
      },
      
      use: function(manager, callback) {
        var script = manager.find(this);
        if (script) {
          script.use(callback);
        } else {
          var script = new DM.Script(this, manager);
          manager.push(this, script);
          script.use(callback);
        }
      },
      
      setRepository: function(repository) {
        this.repository = repository;
        return this;
      },
      
      setFolder: function(folder) {
        folder.add(this);
        this.folder = folder;
      },
      
      resolve: function(query, bang) {  
        var resolved = this.repository.find(query);
        if (resolved) {
          if (resolved == this) {
            vlog(2)("warn", "Ignoring circular reference to", query);
          } else {
            return resolved;
          }
        }
        if (bang) vlog(2)("warn", "Couldn't resolve", query);        
      },
      
      compact: function() {      
        for (var i = 0, query; query = this.deps[i]; i++) this.resolve(query);
      },
            
      getURL: function() {
        return "/" + this.getPrefix() + "/" + this.format();
      },
      
      format: function() {        
        return this.path + ".js";
      },
      
      getPrefix: function() {
        return this.repository.getPrefix();
      },
      
      getName: function() {
        if (!this.name) this.name = this.paths[this.paths.length - 1];
        return this.name;
      },
      
      getPath: function() {
        return DM.File.getPath(this);
      },
      
      toPaths: function() {
        if (this.paths.length > 0) return this.paths;
        var bits = this.repository.getPrefix().split('/').concat(this.path.split('/'));
        while (bits.length) {
          bits.shift();  
          var path = bits.join("/");
          if (path.length) this.paths.push(path);
        }
        return this.paths;
      }
    };
    
    (function() {
      DM.Repository.prototype = {
        
        register: function(tree) {
          this.tree = this.walk(tree);
        },
      
        walk: function(tree, prefix) {
          var result = {};
          for (var name in tree) {
            var node = tree[name];
            result[name] = this.convert(node, DM.File.getPath(node, name, prefix));
          }
          return result;
        },
      
        convert: function(node, path) {
          if (!!node.desc) {
            return this.addFile(node, path)
          } else if (node.real) {
            return this.addRepository(node, path)
          } else if (typeof node == 'object' && !node.push && !node.indexOf) {
            return this.addFolder(node, path);
          }
        },
        
        merge: function(repository, path) {
          for (var i = 0, j = repository.files.length; i < j; i++) {
            this.files.push(repository.files[i]);
          }
          for (var i = 0, j = repository.folders.length; i < j; i++) {
            this.folders.push(repository.folders[i]);
          }
          for (var path in repository.paths) {
            var files = repository.paths[path];
            for (var j = 0, file; file = files[j]; j++) {
              this.addFilePath(path, file);
            }
          }
          return this;
        },
        
        onLookupFailed: function(query) {
          if (this.repository) {
            //if has parent repository, try there
            return this.repository.find(query);
          } else {
            return null
          }
        },
        
        onLookupSucceed: function(query, found) {
          var length = found.length;
          if (length == 1) return found[0];
          for (var i = 0; i < length; i++) {
            
          }
          return found[0];
        },
        
        lookup: function(query) {
          var found = this.paths[query];
          if (found) {
            return this.onLookupSucceed(query, found)
          } else {
            return this.onLookupFailed(query);
          }
        },

        find: function(query) {
          if (query && query.path) {
            return query
          } else {
            return this.lookup(trim(query));
          }
        },
        
        setRepository: function(repository) {
          this.repository = repository;
          return this.compact();
        },
        
        add: function(node) {
          node.setRepository(this)
          return node;
        },
        
        addFile: function(node, path) {
          var file = new DM.File(node, path);
          this.add(file);
          
          if (this._folder) file.setFolder(this._folder); 
          
          this.addFilePaths(file);
          return file;
        },
        
        addRepository: function(node, path) {
          var repository = new DM.Repository(node, path);
          vlog(2)('info', 'Found repository', repository, 'at', path)
          this.merge(this.add(repository));
          return this;
        },
        
        addFolder: function(node, path) {
          var folder = new DM.Folder(node, path);
          
          var old = this._folder;
          this._folder = folder;
          this.walk(node, path);
          this._folder = old;
          
          this.add(folder);
          this.addFolderPath(path, folder)
          return this;
        },
        
        //resolve dependencies in current repository
        compact: function() {
          for (var i = 0, j = this.files.length; i < j; i++) {
            this.files[i].resolve();
          }
          return this;
        },
        
        addFolderPath: function(path, folder) {
          this.folders[trim(path)] = folder;
        },
        
        addFilePath: function(path, file) {
          if (!this.paths[path]) this.paths[path] = [];
          this.paths[path].push(file);
        },
        
        addFilePaths: function(file) {
          for (var paths = file.toPaths(), i = 0, path; path = paths[i]; i++) {
            this.addFilePath(path, file)
          };
        },
        
        getPrefix: function() {
          return this.prefix;
        },
        
        open: function(path) {
          var folder = this.folders[path];
          if (folder) return folder.files;
          return [];
        },
        
        glob: function(path, regexp) {
          var files = this.open(path);
          var filtered = [];
          if (regexp && !regexp.exec) regexp = new RegExp(regexp);
          for (var i = 0, j = files.length; i < j; i++) {
            if (!regexp || files[i].path.match(regexp)) filtered.push(files[i]);
          }
          return filtered;
        }
      };
      
    })();
  
    DM.Queue = function(args, manager, callback) {
      this.stack = args;
      this.callback = callback;
      this.manager = manager;
       if (DM.initialized) { 
        this.next();
      } else { 
        DM.queue(bind(this.next, this));
      }
    };
    
    DM.Queue.prototype = {
  
      chain: function(fn) {
        this.stack.push(fn);
      },
      
      next: function() {
        var name = this.stack.shift();
        var file = DM.find(name);
        if (!file) return vlog(1)("warn", "Couldnt find", name);
        file.use(this.manager, this.getNextStep());
      },
      
      getNextStep: function() {
        return this.isFinished() ? this.callback : bind(this.next, this);
      },
      
      isFinished: function() {
        return this.stack.length == 0;
      }
    };
    
    

    extend(DM, {
      
      onInitialize: function() {
        DM.initialized = true;
        var fn;
        while (fn = this.stack.shift()) fn();
      },
      
      register: function(repository) {
        this.repository = repository;
        this.onInitialize()
      },
      
      queue: function(fn) {
        this.stack.push(fn)
      },
      
      fetch: function (url, path) {
        this.url = url;
        this.path = path;
        new Request(url, this.recieve)
      },
  
      recieve: function(xhr) {
        DM.apply(xhr.responseText);
      },
      
      apply: function(text) {
        console.groupEnd();
        console.groupCollapsed('Dependencies');
        
        DM.register(new DM.Repository(text, DM.path));
      },
      
      use: function(query, callback) {
        var file = DM.find(query);
        if (file) file.use(DM.instance, callback)
        else callback();
      },
      
      format: function(path) {
        if (!this.dummy) this.dummy = new DM.Script;
        return this.dummy.format(path)
      }
      
    });
    
    var methods = ["find", "open", "glob"];
    for (var i = 0, j = methods.length; i < j; i++) {
      (function(method) {
        DM[method] = function() {
          return DM.repository[method].apply(DM.repository, arguments);
        }
      })(methods[i]);
    }
    

    DM.prototype = {

      include: function (source, callback) {
        var head = this.head;
         var script = this.document.createElement('script');
  
        extend(script, {
          onload: callback,
          onreadystatechange: function () {
            var state = this.readyState;
            if ("loaded" === state || "complete" === state) {
              script.onreadystatechange = null;
              callback();
              head.removeChild(script);
            }
          },
          src: source,
          type: 'text/javascript'
        });
        
        head.appendChild(script);
        return script;
      },
  
      using: function() {
        var splatten = $splat(arguments);
        var args = [];
        for (var i = 0, j = splatten.length; i < j; i++) if (splatten[i]) args.push(splatten[i]);
        var callback = (typeof args[args.length - 1] == "function") ? args.pop() : $empty;
  
        if (args.length) {
          return new DM.Queue(args, this, callback);
        } else {
          return callback();
        }
      },
      
      find: function(file) {
        return this.paths[file.path];
      },
      
      push: function(file, instance) {
        this.paths[file.path] = instance;
      },
      
      getDependencies: function(file) {
        if (!this.deps[file.path]) this.deps[file.path] = [].concat(file.deps);
        return this.deps[file.path];
      }
      
    };
    
    DM.staticFileURL = function(path) {
      var prefix = '';
      if (Environment.config.subdomain) {
         var hash = 0;
        for (var chars = path.split("?")[0], i = 0, ch; ch = chars[i++];) hash += ch.charCodeAt(0)
        prefix = Environment.config.subdomain.replace('%i', hash % Environment.config.hosts + 1) + '.';
      }
      
      return location.protocol + '//' + prefix + location.host.replace(/^.*?(\w*\.\w*)$/, '$1') + path;
    }

    //Plugins

    //Autoloading (loads Widget.Ext.js after Widget.js if found)
    if (Environment.config.autoload) {
      (function(onLoad) {  
        DM.Script.prototype.onLoad = function() {        
          if (!this.extended) {
            this.extended = true;
            this.extension = DM.repository.lookup(this.file.getName() + '.Ext');
            if (this.extension) this.extension.extended = true;
          }
                
          if (this.extension) {
            return this.extension.use(this.manager, bind(onLoad, this))
          } else {
            return onLoad.call(this);
          }
        }
      })(DM.Script.prototype.onLoad);
    }
    
    //Script packaging
    if (Environment.config.pack) {
      $loaded = {};
      $loaded.push = function(path) {
        var file = DM.find(path);
        if (file) {
          file.state = 2;
          vlog(2)(path, "is unpacked and loaded")
        } else {
          vlog(2)("warn", path, "is thrown as loaded, but can not be found")
        }
        
      };
  
      (function(setData) {  
        DM.File.prototype.setData = function(data) {
          setData.apply(this, arguments);
          if (data.packed) this.packed = data.packed;
        }
      })(DM.File.prototype.setData);

      (function(find) {
        DM.Repository.prototype.find = function(query) {
          var found = find.apply(this, arguments);
          if (found && found.packed) {
            vlog(1, found.name, "is found, but is packed");
            return this.find(found.packed)
          }
          return found;
        }
      })(DM.Repository.prototype.find)
    }
    
    //Index file cache
    if (Environment.config.cache) {
      
      (function() {
        var tag, old;
        if (window.name.length) {
          var index = window.name.indexOf(':');
          tag = window.name.substr(0, index);
          old = window.name.substr(index + 1, 50000);
        }

        (function(fetch) {
          DM.fetch = function(url, path) {
            if (window.name.length) {
              if (tag == Environment.params.version) {
                this.url = url;
                this.path = path;
                return DM.apply(old);    
              }
            }

            fetch.apply(DM, arguments);
          }
        })(DM.fetch);

        (function(apply) {
          DM.apply = function(text) {
            if (tag != Environment.params.version) window.name = Environment.params.version + ':' + text;
            apply(text);
          }
        })(DM.apply);  
      })();

    }

  })();
})();


$dependencies = Environment.things.builder = new DM;
var using = function() {
  return Environment.things.builder.using.apply(Environment.things.builder, arguments);
};

DM.fetch(Environment.config.index, Environment.config.path);

