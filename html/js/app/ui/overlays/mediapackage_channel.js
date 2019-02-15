/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */


define(["jquery", "lodash", "app/alarms", "app/ui/overlays/overlay_tools"],
    function($, _, alarms, tools) {

        var match_type = "MediaPackage Channel";

        var decorate_alarms = function(drawing, font_size, width, height, id) {
            var alarm_count = 0;
            alarms.get_subscribers_with_alarms().current.forEach(function(item) {
                if (item.ResourceArn == id) {
                    alarm_count = item.AlarmCount;
                }
            });
            tools.set_alarm_text("Active alarms: " + alarm_count, drawing, font_size, width);
        };


        var decorate_events = function(drawing, font_size, width, height, id) {

        };

        var decorate_information = function(drawing, font_size, width, height, id) {

        };

        var decorate = function(drawing, font_size, width, height, id) {
            decorate_alarms(drawing, font_size, width, height, id);
            decorate_events(drawing, font_size, width, height, id);
            decorate_information(drawing, font_size, width, height, id);
        };

        return {
            "match_type": match_type,
            "decorate": decorate,
            "informational": false
        };

    });