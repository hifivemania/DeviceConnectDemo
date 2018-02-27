$(() => {
    var dcLogic = {
        __name: 'DCLogic',
        __services: [],
        __accessToken: null,
        __clientId: null,

        // セットアップ処理全体
        setup: function(options) {
            var dfd = this.deferred();
            var me = this;
            var results = {};
            this.check(options)
                .then(function() {
                    // 認可を得る
                    return me.grant(options);
                })
                .then(function(response) {
                    results = {
                        accessToken: response.accessToken,
                        clientId: response.clientId
                    };
                    // 使えるサービスの一覧を得る
                    return me.discover(results);
                })
                .then(function(services) {
                    results.services = services;
                    return dfd.resolve(results);
                })
                // エラーの時はここ
                .fail(function(err) {
                    dfd.reject(err);
                })
            return dfd.promise();
        },

        // DeviceConnectの生死チェック
        check: function(options) {
            var dfd = this.deferred();
            dConnect.setHost(options.host.split(":")[0]);
            dConnect.setPort(options.host.split(":")[1]);
            dConnect.checkDeviceConnect(
                function(apiVersion) {
                    dfd.resolve({apiVersion: apiVersion});
                },
                function (errorCode, errorMessage) {
                    dfd.reject({
                        errorCode: errorCode,
                        errorMessage: errorMessage
                    });
                }
            );
            return dfd.promise();
        },

        // 認可を得る処理
        grant: function(options) {
            var dfd = this.deferred();
            if (this.clientId && this.accessToken != "") {
                return dfd.resolve({
                    accessToken: this.accessToken,
                    clientId: this.clientId
                });
                
            }
            dConnect.authorization(
                options.scopes,
                options.applicationName,
                function (clientId, accessToken) {
                    dfd.resolve({
                        clientId: clientId,
                        accessToken: accessToken
                    });
                },
                function (errorCode, errorMessage) {
                    dfd.reject({
                        errorCode: errorCode,
                        errorMessage: errorMessage
                    });
                }
            );
            return dfd.promise();
        },

        // サービスをリストアップする処理
        discover: function(options) {
            var dfd = this.deferred();
            me = this;
            dConnect.discoverDevices(
                options.accessToken,
                function (json) {
                    dfd.resolve(json.services);
                },
                function (errorCode, errorMessage) {
                    dfd.reject({
                        errorCode: errorCode,
                        errorMessage: errorMessage
                    });
                }
            );
            return dfd.promise();
        },

        // サービスを見つける処理
        findService: function(name) {
            for (i in this.__services) {
                if (this.__services[i].id.toLowerCase().indexOf(name.toLowerCase()) == 0) {
                    return this.__services[i].id;
                }
            }
        },

        // バイブレーション
        vibrate: function() {
            var dfd = this.deferred();
            var service = this.findService("host");
            var builder = new dConnect.URIBuilder();
            builder.setProfile("vibration");
            builder.setAttribute('vibrate');
            builder.setServiceId(service);
            builder.setAccessToken(this.__accessToken);
            builder.addParameter(dConnect.constants.vibration.PARAM_PATTERN, "1000,2000");
            var uri = builder.build();
            dConnect.put(uri, null, null, (json) => {
                dfd.resolve("処理成功しました");
            }, (errorCode, errorMessage) => {
                dfd.reject({
                    errorCode: errorCode,
                    errorMessage: errorMessage
                });
            });
            return dfd.promise();
        },

        // ライトのオン、オフ
        light: function(status) {
            var dfd = this.deferred();
            var service = this.findService("host");
            var builder = new dConnect.URIBuilder();
            builder.setProfile("light");
            builder.setServiceId(service);
            builder.setAccessToken(this.__accessToken);
            const uri = builder.build();
            let method = 'post';
            if (!status) {
                method = 'delete';
            }
            dConnect[method](uri, null, null, (json) => {
                dfd.resolve("処理成功しました");
            }, (errorCode, errorMessage) => {
                dfd.reject({
                    errorCode: errorCode,
                    errorMessage: errorMessage
                });
            });
            return dfd.promise();
        },

        // 通知処理
        notify: function(body) {
            var dfd = this.deferred();
            const service = me.findService("host");
            const builder = new dConnect.URIBuilder();
            builder.setProfile("notification");
            builder.setAttribute('notify');
            builder.setServiceId(service);
            builder.addParameter(
                dConnect.constants.notification.PARAM_BODY,
                body
            );
            builder.addParameter(
                dConnect.constants.notification.PARAM_TYPE,
                dConnect.constants.notification.NOTIFICATION_TYPE_PHONE
            );
            builder.setAccessToken(this.__accessToken);
            const uri = builder.build();
            // PUTメソッドを実行します
            dConnect.post(uri, null, null, (json) => {
                dfd.resolve("処理成功しました");
            }, (errorCode, errorMessage) => {
                dfd.reject({
                    errorCode: errorCode,
                    errorMessage: errorMessage
                });
            });
            return dfd.promise();
        }
    };
    
    var appController = {
        __name: 'AppController',
        dcLogic: dcLogic,
        // デフォルトの設定
        __applicationName: "WoT",
        __host: url('?host') || 'localhost:4035',
        __scopes: [
            "battery",
            "serviceinformation",
            "servicediscovery",
            "notification",
            "vibration",
            "light"
        ],

        // コントローラ化が完了したら実行
        __ready: function() {
            this.setup();
        },
        
        // セットアップ処理
        setup: function(response) {
            if (!response) 
                return this.setup(this.dcLogic.setup({
                    applicationName: this.__applicationName,
                    host: this.__host,
                    scopes: this.__scopes
                }));
            if (h5.async.isPromise(response)) {
                return response.done(this.own(function(response) {
                  this.setup(response);  
                }));
            }
            this.dcLogic.__accessToken = response.accessToken;
            this.dcLogic.__clientId = response.clientId;
            this.dcLogic.__services = response.services;
        },

        // バイブレーション実行
        '#vibrate click': function (e) {
            this.dcLogic.vibrate()
                .then(function(message) {
                    alert(message);
                })
                .fail(function(error) {
                    alert(JSON.stringify(error));
                });
        },

        // ライトをオンにする処理
        '#lightOn click': function(e) {
            this.dcLogic.light(true)
                .then(function(message) {
                    alert(message);
                })
                .fail(function(error) {
                    alert(JSON.stringify(error));
                });
        },

        // ライトをオフにする処理
        '#lightOff click': function(e) {
            this.dcLogic.light(false)
                .then(function(message) {
                    alert(message);
                })
                .fail(function(error) {
                    alert(JSON.stringify(error));
                });
        },
        
        // 通知ボタンを押した時の処理
        '#notify click': function(e) {
            this.dcLogic.notify($('#body').val());
        }
    };

    h5.core.controller('.container', appController);
});
