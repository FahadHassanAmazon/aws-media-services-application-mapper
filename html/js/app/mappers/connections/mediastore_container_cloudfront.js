/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "app/model", "app/server", "app/connections"],
    function($, model, server, connections) {

        var update_connections = function() {
            var current = connections.get_current();
            var url = current[0];
            var api_key = current[1];
            return new Promise((resolve, reject) => {
                server.get(url + "/cached/mediastore-container-cloudfront-distribution/global", api_key).then((connections) => {
                    for (let connection of connections) {
                        var data = JSON.parse(connection.data);
                        model.edges.update({
                            "id": connection.arn,
                            "to": connection.to,
                            "from": connection.from,
                            "data": data,
                            "label": data.label,
                            "arrows": "to",
                            "color": {
                                "color": "black"
                            }
                        });
                    }
                    resolve();
                });
            });
        }

        var update = function() {
            return new Promise((resolve, reject) => {
                update_connections().then(function() {
                    resolve();
                }).catch(function(error) {
                    console.log(error);
                    reject(error);
                });
            });
        }

        return {
            "name": "MediaStore Containers to CloudFront Distributions",
            "update": update
        };
    });