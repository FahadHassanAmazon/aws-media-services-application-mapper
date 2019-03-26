/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */
define(["jquery", "lodash", "app/ui/util", "app/model", "app/ui/layout", "app/ui/diagram_statemachine_factory", "app/ui/alert", "app/settings", "app/ui/vis_options"],
    function($, _, ui_util, model, layout, diagram_statemachine_factory, alert, settings, vis_options) {
        class Diagram {

            constructor(name, view_id) {
                // recurring and one-time callbacks
                this.click_callbacks = [];
                this.click_callbacks_once = [];
                this.doubleclick_callbacks = [];
                this.doubleclick_callbacks_once = [];
                this.node_dataset_callbacks = [];
                this.node_dataset_callbacks_once = [];
                // DOM containers
                this.tab_container = $("#diagram-tab");
                this.diagram_container = $("#diagram-tab-content");
                // this is used as the display name (UI display)
                this.name = name;
                // this is used as any internal ID for the diagram/view, including layout, settings
                this.view_id = view_id;
                // make a unique id for our base elements
                this.base_id = ui_util.makeid();
                // create ids for our tab and diagram div
                this.tab_id = "tab_" + this.base_id;
                this.diagram_id = "diagram_" + this.base_id;
                // drag-select
                this.drag_canvas;
                this.drag_ctx;
                this.drag_rect = {};
                this.drag = false;
                this.drawingSurfaceImageData;
                // other state
                this.first_fit = false;
                // This FSM manages the startup and state restoration
                this.statemachine = diagram_statemachine_factory.create(this);
                // development logging
                this.statemachine.on("transition", (function() {
                    return function(data) {
                        // log the state transitions of the FSMs
                        console.log(data);
                    };
                })());
                // build it, restore it
                this.statemachine.start();
            }

            remove() {
                // remove the tab and the div
                $("#" + this.tab_id).remove();
                $("#" + this.diagram_id).remove();
            }

            layout_vertical(save) {
                var my_diagram = this;
                settings.get("layout-method").then(function(response) {
                    var method = response.method;
                    var options = vis_options.vertical_layout;
                    options.layout.hierarchical.sortMethod = method;
                    my_diagram.network.once("afterDrawing", (function() {
                        return function() {
                            console.log("layout finished");
                            my_diagram.network.setOptions(vis_options.without_layout);
                            my_diagram.layout_isolated(false);
                            my_diagram.network.fit();
                            if (save) {
                                layout.save_layout(my_diagram);
                            }
                        }
                    })());
                    console.log("layout start");
                    my_diagram.network.setOptions(options);
                });
            }

            layout_horizontal(save) {
                var my_diagram = this;
                settings.get("layout-method").then(function(response) {
                    var method = response.method;
                    var options = vis_options.horizontal_layout;
                    options.layout.hierarchical.sortMethod = method;
                    my_diagram.network.once("afterDrawing", (function() {
                        return function() {
                            console.log("layout finished");
                            my_diagram.network.setOptions(vis_options.without_layout);
                            my_diagram.layout_isolated(false);
                            my_diagram.network.fit();
                            if (save) {
                                layout.save_layout(my_diagram);
                            }
                        }
                    })());
                    console.log("layout start");
                    my_diagram.network.setOptions(options);
                });
            }

            layout_isolated(save) {
                var isolated = new Map();
                var diagram = this;
                $.each(this.nodes.getIds(), function(id_index, node_id) {
                    var connected = diagram.network.getConnectedNodes(node_id);
                    if (connected.length === 0) {
                        var node = diagram.nodes.get(node_id);
                        var group = isolated.get(node.title);
                        if (!group) {
                            group = [node_id];
                        } else {
                            group.push(node_id);
                        }
                        isolated.set(node.title, group);
                    }
                });
                var dimensions = diagram.node_dimensions();
                var pad_x = Math.ceil(dimensions.max_width * 1.25);
                var pad_y = Math.ceil(dimensions.max_height * 1.25);
                isolated.forEach(function(value, key, map) {
                    var node_ids = value;
                    var bounds = diagram.bounds();
                    // extra padding at the start
                    var start_x = bounds.max_x + (pad_x * 2);
                    var current_x = start_x;
                    var current_y = bounds.min_y + pad_y;
                    var nodes_per_row = Math.ceil(Math.sqrt(node_ids.length));
                    var current_row_nodes = 0;
                    $.each(node_ids, function(id_index, id) {
                        diagram.network.moveNode(id, current_x, current_y);
                        current_row_nodes += 1;
                        if (current_row_nodes < nodes_per_row) {
                            current_x += pad_x;
                        } else {
                            current_row_nodes = 0;
                            current_x = start_x;
                            current_y += pad_y;
                        }
                    });
                });
                if (save) {
                    layout.save_layout(diagram);
                }
            }

            node_dimensions() {
                var max_width = 0;
                var max_height = 0;
                try {
                    var node_id = _.head(this.nodes.getIds());
                    var box = this.network.getBoundingBox(node_id);
                    var height = Math.abs(box.bottom - box.top);
                    var width = Math.abs(box.right - box.left);
                    if (height > max_height) {
                        max_height = height;
                    }
                    if (width > max_width) {
                        max_width = width;
                    }
                } catch (error) {
                    // print only
                    console.log(error);
                    max_height = 0;
                    max_height = 0;
                }
                return {
                    "max_width": max_width,
                    "max_height": max_height
                }
            };

            bounds() {
                var min_x = Number.MAX_SAFE_INTEGER;
                var max_x = Number.MIN_SAFE_INTEGER;
                var min_y = Number.MAX_SAFE_INTEGER;
                var max_y = Number.MIN_SAFE_INTEGER;
                var positions = this.network.getPositions();
                $.each(positions, function(pos_index, pos_value) {
                    if (pos_value.x > max_x) {
                        max_x = pos_value.x;
                    }
                    if (pos_value.x < min_x) {
                        min_x = pos_value.x;
                    }
                    if (pos_value.y > max_y) {
                        max_y = pos_value.y;
                    }
                    if (pos_value.y < min_y) {
                        min_y = pos_value.y;
                    }
                });
                return {
                    "min_x": min_x,
                    "max_x": max_x,
                    "min_y": min_y,
                    "max_y": max_y
                }
            }

            restore_nodes() {
                var diagram = this;
                return new Promise(function(resolve, reject) {
                    layout.retrieve_layout(diagram).then(function(layout_items) {
                        var node_ids = _.map(layout_items, "id");
                        var nodes = _.compact(model.nodes.get(node_ids));
                        diagram.nodes.update(nodes);
                        resolve();
                    }).catch(function(error) {
                        console.log(error);
                        reject(error);
                    });
                });
            }

            restore_layout() {
                var diagram = this;
                return new Promise(function(resolve, reject) {
                    layout.retrieve_layout(diagram).then(function(layout_items) {
                        layout_items.forEach(function(item) {
                            var node = diagram.nodes.get(item.id);
                            if (node) {
                                diagram.network.moveNode(item.id, item.x, item.y);
                            } else {
                                console.log("purging layout for node id " + item.id);
                                layout.delete_layout(diagram, [item.id]);
                            }
                        });
                        resolve();
                    }).catch(function(error) {
                        console.log(error);
                        reject(error);
                    });
                });
            }

            restore_edges() {
                for (var node_id of this.nodes.getIds()) {
                    // find all edges connected to this node
                    var matches = model.edges.get({
                        filter: function(edge) {
                            return (edge.to == node_id || edge.from == node_id);
                        }
                    });
                    // add each edge if both nodes are present
                    for (var edge of matches) {
                        if (this.edges.get(edge.id) == null) {
                            // compact nulls, do we have both ends?
                            var ends = _.compact(this.nodes.get([edge.to, edge.from]));
                            if (ends.length == 2) {
                                // yes, add the edge between the endpoints
                                this.edges.update(edge);
                            }
                        }
                    }
                }
            }

            synchronize_edges(event, node_ids) {
                var diagram = this;
                if (event == "add" || event == "update") {
                    for (var id of node_ids) {
                        // query all edges from the model with this node
                        model.edges.forEach(function(edge) {
                            if (edge.to == id) {
                                // check 'from' node is on diagram
                                if (diagram.nodes.get(edge.from)) {
                                    console.log("connecting nodes");
                                    diagram.edges.update(edge);
                                }
                            } else
                            if (edge.from == id) {
                                // check 'to' node is on diagram
                                if (diagram.nodes.get(edge.to)) {
                                    console.log("connecting nodes");
                                    diagram.edges.update(edge);
                                }
                            }
                        }, {
                            filter: function(edge) {
                                return edge.to == id || edge.from == id;
                            }
                        });
                    }
                } else
                if (event == "remove") {
                    for (var id of node_ids) {
                        // query all edges on the diagram 
                        diagram.edges.forEach(function(edge) {
                            console.log("removing unneeded edge");
                            diagram.edges.remove(edge.id);
                        }, {
                            filter: function(edge) {
                                return edge.to == id || edge.from == id;
                            }
                        });
                    }
                }
            }

            synchronize_content(event, node_ids) {
                var diagram = this;
                if (event == "add" || event == "update") {
                    layout.save_layout(diagram, node_ids);
                } else
                if (event == "remove") {
                    layout.delete_layout(diagram, node_ids);
                }
            }

            hide_div() {
                $("#" + this.diagram_div).hide();
            }

            show_div() {
                $("#" + this.diagram_div).show();
            }

            show() {
                $("#" + this.tab_id).tab("show");
            }

            shown() {
                return $("#" + this.tab_id).attr("aria-selected") == 'true';
            }

            fit_to_nodes(node_ids) {
                if (Array.isArray(node_ids)) {
                    this.network.fit({
                        nodes: node_ids,
                        animation: true
                    });
                }
            }

            fit_to_nearest(x, y) {
                // get the vis canvas location of the doubletap
                var click_x = x;
                var click_y = y;
                var network = this.network;
                var closest = null;
                // get all the node locations
                var positions = network.getPositions();
                // find the node closest to the doubletap
                for (var p of Object.entries(positions)) {
                    if (closest == null) {
                        closest = {
                            id: p[0],
                            dx: Math.abs(click_x - p[1].x),
                            dy: Math.abs(click_y - p[1].y)
                        };
                    } else {
                        var dx = Math.abs(click_x - p[1].x);
                        var dy = Math.abs(click_y - p[1].y);
                        // update the closest node if better one is found
                        if (dx + dy < closest.dx + closest.dy) {
                            closest = {
                                id: p[0],
                                dx: dx,
                                dy: dy
                            };
                        }
                    }
                }
                if (closest != null) {
                    // zoom to the closest node to the doubletap
                    network.fit({
                        nodes: [closest.id],
                        animation: true
                    });
                }
            }

            save_drawing_surface() {
                this.drawingSurfaceImageData = this.drag_ctx.getImageData(0, 0, this.drag_canvas.width, this.drag_canvas.height);
            }

            restore_drawing_surface() {
                this.drag_ctx.putImageData(this.drawingSurfaceImageData, 0, 0);
            }

            select_nodes_from_highlight() {
                var fromX, toX, fromY, toY;
                var nodesIdInDrawing = [];
                var xRange = this.get_start_to_end(this.drag_rect.startX, this.drag_rect.w);
                var yRange = this.get_start_to_end(this.drag_rect.startY, this.drag_rect.h);

                var allNodes = this.nodes.get();
                for (var i = 0; i < allNodes.length; i++) {
                    var curNode = allNodes[i];
                    var nodePosition = this.network.getPositions([curNode.id]);
                    var nodeXY = this.network.canvasToDOM({
                        x: nodePosition[curNode.id].x,
                        y: nodePosition[curNode.id].y
                    });
                    if (xRange.start <= nodeXY.x && nodeXY.x <= xRange.end && yRange.start <= nodeXY.y && nodeXY.y <= yRange.end) {
                        nodesIdInDrawing.push(curNode.id);
                    }
                }
                this.network.selectNodes(nodesIdInDrawing);
                alert.show(nodesIdInDrawing.length + " selected");
            }

            get_start_to_end(start, theLen) {
                return theLen > 0 ? {
                    start: start,
                    end: start + theLen
                } : {
                    start: start + theLen,
                    end: start
                };
            }

            add_singleclick_callback(callback, once = false) {
                if (once) {
                    if (!this.click_callbacks_once.includes(callback)) {
                        this.click_callbacks_once.push(callback);
                    }
                } else {
                    if (!this.click_callbacks.includes(callback)) {
                        this.click_callbacks.push(callback);
                    }
                }
            }

            add_doubleclick_callback(callback, once = false) {
                if (once) {
                    if (!this.doubleclick_callbacks_once.includes(callback)) {
                        this.doubleclick_callbacks_once.push(callback);
                    }
                } else {
                    if (!this.doubleclick_callbacks.includes(callback)) {
                        this.doubleclick_callbacks.push(callback);
                    }
                }
            }

            add_node_dataset_callback(callback, once = false) {
                if (once) {
                    if (!this.node_dataset_callbacks_once.includes(callback)) {
                        this.node_dataset_callbacks_once.push(callback);
                    }
                } else {
                    if (!this.node_dataset_callbacks.includes(callback)) {
                        this.node_dataset_callbacks.push(callback);
                    }
                }
            }

            remove_node_dataset_callback(callback, once = false) {
                if (once) {
                    if (!this.node_dataset_callbacks_once.includes(callback)) {
                        this.node_dataset_callbacks_once.push(callback);
                    }
                } else {
                    if (!this.node_dataset_callbacks.includes(callback)) {
                        this.node_dataset_callbacks.push(callback);
                    }
                }
            }

            blink(blinks, id) {
                var interval_ms = 500;
                id = Array.isArray(id) ? id : [id];
                var diagram = this;
                if (blinks > 0) {
                    setTimeout(
                        function() {
                            if (blinks % 2 == 0) {
                                diagram.network.selectNodes(id, false);
                            } else {
                                diagram.network.unselectAll();
                            }
                            diagram.blink(blinks - 1, id);
                        }, interval_ms);
                } else {
                    diagram.network.unselectAll();
                }
            }
        };

        function create(name, view_id) {
            return new Diagram(name, view_id);
        }

        // this shuts down the browser's context menu
        document.body.oncontextmenu = function() {
            return false;
        };

        return {
            "create": create
        };

    });