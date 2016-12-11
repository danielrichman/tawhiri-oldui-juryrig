/*
 * CUSF Landing Prediction Version 2
 * Jon Sowman 2010
 * jon@hexoc.com
 * http://www.hexoc.com
 *
 * http://github.com/jonsowman/cusf-standalone-predictor
 *
 * This file contains javascript functions related to the handling
 * of the user interface for the predictor.
 *
 */

// Initialise the UI - this must be called on document ready
function initUI() {
    // Make UI elements such as windows draggable
    $("#input_form").draggable({containment: '#map_canvas', handle:
        'img.handle', snap: '#map_canvas'});
    $("#scenario_info").draggable({containment: '#map_canvas', handle:
        'img.handle', snap: '#map_canvas'});
    $("#location_save").draggable({containment: '#map_canvas', handle:
        'img.handle', snap: '#map_canvas'});
    $("#location_save_local").draggable({containment: '#map_canvas', handle:
            'img.handle', snap: '#map_canvas'});
    $("#burst-calc-wrapper").draggable({containment: '#map_canvas', handle:
            'img.handle', snap: '#map_canvas'}); 
    
    // Activate buttons to jqueryui styling
    $("#run_pred_btn").button();
    $("#req_sub_btn").button();
    $("#burst-calc-use").button();
    $("#burst-calc-close").button();
    $("#burst-calc-advanced-show").button();
    $("#burst-calc-advanced-hide").button();

    EH_LaunchCard();
    EH_BurstCalc();
    EH_NOTAMSettings();
    EH_ScenarioInfo();
    EH_LocationSave();

    // Tipsylink tooltip class activation
    $(".tipsyLink").tipsy({fade: true});

    // Add the onmove event handler to the map canvas
    google.maps.event.addListener(map, 'mousemove', function(event) {
        showMousePos(event.latLng);
    });
}

// Throw an error window containing <data> and a 'close' link
function throwError(data) {
    $("#error_message").empty().append(data);
    $("#error_window").fadeIn();
}

// Reset the GUI to a onLoad state ready for a new prediction to be shown
function resetGUI() {
    $("#status_message").fadeOut(500);
    $("#error_window").fadeOut(500);
    $("#modelForm").find("input").attr("disabled", false);

    // now clear the status window
    $("#prediction_status").html("");
    cursorPredHide();

    // bring the input form back up
    toggleWindow("input_form", null, null, null, "show");
    toggleWindow("scenario_info", null, null, null, "show");
    // un-fade the map canvas
    $("#map_canvas").fadeTo(1500, 1);
}

// Prevent flicker on fast responses by delaying hide for a small time
var cursorPredHideHandle;
function cursorPredHide() {
    if (cursorPredHideHandle)
        return;

    cursorPredHideHandle = setTimeout(function () {
        cursorPredHideHandle = null;
        $("#cursor_pred").hide();
    }, 200);
}

function cursorPredShow() {
    if (cursorPredHideHandle) {
        clearTimeout(cursorPredHideHandle);
        cursorPredHideHandle = null;
    }
    $("#cursor_pred").show();
}

// Append a line to the debug window and scroll the window to the bottom
// Optional boolean second argument will clear the debug window if TRUE
function appendDebug(appendage, clear) {
    if ( clear == null ){
        var curr = $("#debuginfo").html();
        curr += "<br>" + appendage;
        $("#debuginfo").html(curr);
    } else {
        $("#debuginfo").html("");
    }
    // keep the debug window scrolled to bottom
    scrollToBottom("scenario_template_scroller");
}

// A function to scroll a scrollable <div> all the way to the bottom
function scrollToBottom(div_id) {
    $("#"+div_id).stop().animate({scrollTop: $("#"+div_id)[0].scrollHeight});
}

// Show or hide GUI windows, can either "toggle", or force hide/show
// Takes the window name, the linker ID, the event handlers for
// 'onhide' and 'onshow', and a boolean 'force' parameter
function toggleWindow(window_name, linker, onhide, onshow, force) {
    $("#"+window_name+"").stop(true, true)

    if ( force == null ) {
        if( $("#"+window_name).css('display') != "none" ){
            $("#"+window_name+"").hide("slide", { direction: "down" }, 500);
            $("#"+linker).html(onhide);
        } else {
            $("#"+window_name).show("slide", { direction: "down" }, 500);
            $("#"+linker).html(onshow);
        }
    } else if ( force == "hide" ) {
        if( $("#"+window_name).css('display') != "none" ){
            $("#"+window_name+"").hide("slide", { direction: "down" }, 500);
            $("#"+linker).html(onhide);
        }
    } else if ( force == "show") {
        if( $("#"+window_name).css('display') == "none" ){
            $("#"+window_name).show("slide", { direction: "down" }, 500);
            $("#"+linker).html(onshow);
        }
    } else {
        appendDebug("toggleWindow force parameter unrecognised");
    }
}

// Set the selected item to "Other" in the launch locations selector
function SetSiteOther() {
    $("#site").val("Other");
}

function EH_BurstCalc() {
    // Activate the "use burst calc" links
    $("#burst-calc-show").click(function() {
        $("#burst-calc-wrapper").show();
    });
    $("#burst-calc-show").hover(
        function() {
            $("#ascent,#burst").css("background-color", "#AACCFF");
        },
        function() {
            $("#ascent,#burst").css("background-color", "");
        });
    $("#burst-calc-use").click(function() {
        // Write the ascent rate and burst altitude to the launch card
        $("#ascent").val($("#ar").html());
        $("#burst").val($("#ba").html());
        $("#burst-calc-wrapper").hide();
    });
    $("#burst-calc-close").click(function() {
        // Close the burst calc without doing anything
        $("#burst-calc-wrapper").hide();
        $("#modelForm").show();
    });
    $("#burst-calc-advanced-show").click(function() {
        // Show the burst calculator constants
        // We use a callback function to fade in the new content to make
        // sure the old content has gone, in order to create a smooth effect
        $("#burst-calc").fadeOut('fast', function() {
            $("#burst-calc-constants").fadeIn();
        });
    });
    $("#burst-calc-advanced-hide").click(function() {
        // Show the burst calculator constants
        $("#burst-calc-constants").fadeOut('fast', function() {
            $("#burst-calc").fadeIn();
        });
    });
}

function EH_NOTAMSettings() {
    // Activate the checkbox 
    $("#notam-display").click(function() {
        if (document.modelForm.notams.checked){
            if (kmlLayer == null) kmlLayer = new google.maps.KmlLayer('http://www.habhub.org/kml_testing/notam_and_restrict.kml', {preserveViewport: true});
            kmlLayer.setMap(map);
	}
	else {
	    kmlLayer.setMap(null);
	}
    });
    // Activate the "notam settings" links
    $("#notam-settings-show").click(function() {
        $("#notam-settings-wrapper").show();
    });
    $("#notam-settings-close").click(function() {
        // Close the notam settings doing anything
        $("#notam-settings-wrapper").hide();
        $("#modelForm").show();
    });
}

function EH_LaunchCard() {
    // Activate the "Set with Map" link
    $("#setWithClick").click(function() {
        setLatLonByClick(true);
    });
    $("#setWithClick,#req_open").hover(
        function() {
            $("#lat,#lon").css("background-color", "#AACCFF");
        },
        function() {
            $("#lat,#lon").css("background-color", "");
        });
    // Launch card parameter onchange event handlers
    $("#lat").change(function() {
        plotClick();
    });
    $("#lon").change(function() {
        plotClick();
    });

    $("#site").change(function() {
        changeLaunchSite();
    });
}

function EH_ScenarioInfo() {
    // Controls in the Scenario Information window
    $("#showHideDebug").click(function() {
        toggleWindow("scenario_template", "showHideDebug", "Show Debug", "Hide Debug");
    });
    $("#showHideDebug_status").click(function() {
        toggleWindow("scenario_template", "showHideDebug", "Show Debug", "Hide Debug");
    });
    $("#showHideForm").click(function() {
        toggleWindow("input_form", "showHideForm", "Show Launch Card",
            "Hide Launch Card");
    });
    $("#closeErrorWindow").click(function() {
        $("#error_window").fadeOut();
    });

    $("#about_window_show").click(function() {
        $("#about_window").dialog({
            modal:true,
            width:600,
            height: $(document).height() - 200,
            buttons: {
                Close: function() {
                        $(this).dialog('close');
                    }
            }
        });
    });
}

function EH_LocationSave() {
    // Location saving to cookies event handlers
    $("#req_sub_btn").click(function() {
        saveLocationToCookie();
    });
    $("#cookieLocations").click(function() {
        appendDebug("User requested locally saved launch sites");
        if ( constructCookieLocationsTable("cusf_predictor") ) {
            $("#location_save_local").fadeIn();
        }
    });
    $("#req_open").click(function() {
            var lat = $("#lat").val();
            var lon = $("#lon").val();
            $("#req_lat").val(lat);
            $("#req_lon").val(lon);
            $("#req_alt").val($("#initial_alt").val());
            appendDebug("Trying to reverse geo-code the launch point");
            rvGeocode(lat, lon, "req_name");
            $("#location_save").fadeIn();
    })
    $("#req_close").click(function() {
            $("#location_save").fadeOut();
    });
    $("#locations_close").click(function() {
            $("#location_save_local").fadeOut();
    });
}
