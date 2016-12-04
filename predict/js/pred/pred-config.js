/*
 * CUSF Landing Prediction Version 2
 * http://www.cuspaceflight.co.uk
 *
 * Jon Sowman 2010
 * jon@hexoc.com
 * http://www.hexoc.com
 *
 * http://github.com/jonsowman/cusf-standalone-predictor
 *
 */

// JavaScript configuration options in this file
// To keep the index page JS-free

var map;
var kmlLayer = null;
var map_items = [];
var launch_img = "images/target-1-sm.png";
var land_img = "images/target-8-sm.png";
var burst_img = "images/pop-marker.png";
var clickListener;
var clickMarker;
