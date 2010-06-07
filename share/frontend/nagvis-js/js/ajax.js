/*****************************************************************************
 *
 * ajax.js - Functions for handling NagVis Ajax requests
 *
 * Copyright (c) 2004-2010 NagVis Project (Contact: info@nagvis.org)
 *
 * License:
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
 *
 *****************************************************************************/
 
/**
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */

// Array to store the cached queries
var ajaxQueryCache = {};
// Cache lifetime is 30 seconds (30,000 milliseconds)
var ajaxQueryCacheLifetime = 30000;

/**
 * Function to create an XMLHttpClient in a cross-browser manner
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function initXMLHttpClient() {
	var xmlhttp;
	
	try {
		// Mozilla / Safari / IE7
		xmlhttp = new XMLHttpRequest();
	} catch (e) {
		// IE
		var XMLHTTP_IDS = [ 'MSXML2.XMLHTTP.5.0',
		                    'MSXML2.XMLHTTP.4.0',
		                    'MSXML2.XMLHTTP.3.0',
		                    'MSXML2.XMLHTTP',
		                    'Microsoft.XMLHTTP' ];
		
		var success = false;
		
		for(var i = 0, len = XMLHTTP_IDS.length; i < len && !success; i++) {
			try {
				xmlhttp = new ActiveXObject(XMLHTTP_IDS[i]);
				success = true;
			} catch (e) {}
		}
	
		if (!success) {
			throw new Error('Unable to create XMLHttpRequest.');
		}
	}
	
	return xmlhttp;
}

/**
 * Saves the query information to the query cache. The query cache persists
 * unless the page is being reloaded
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function updateQueryCache(url, timestamp, response) {
	ajaxQueryCache[url] = { "timestamp": timestamp, "response": response };
	eventlog("ajax", "debug", "Caching Query: "+url);
}

/**
 * Removes the query cache for a given url
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function cleanupQueryCache(sUrl) {
	// Set to null in array
	ajaxQueryCache[sUrl] = null;
	
	// Really remove key
	delete ajaxQueryCache[sUrl];
	
	eventlog("ajax", "debug", "Removed cached ajax query:"+sUrl);
}

/**
 * Cleans up the ajax query cache. It removes the deprecated cache entries and
 * shrinks the cache array.
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function cleanupAjaxQueryCache() {
	// Loop query cache array
	eventlog("ajax", "debug", "Removing old cached ajax queries");
	for(var sKey in ajaxQueryCache) {
		// If cache expired remove and shrink the array
		if(iNow - ajaxQueryCache[sKey].timestamp > ajaxQueryCacheLifetime) {
			cleanupQueryCache(sKey);
		}
	}
}

function ajaxError(e) {
	// Add frontend eventlog entry
	eventlog("ajax", "critical", "Problem while ajax transaction");
	eventlog("ajax", "debug", e.toString());
	
	frontendMessage({'type': 'CRITICAL', 'title': 'Ajax transaction error', 'message': 'Problem while ajax transaction. Is the NagVis host reachable?'});
}

function phpError(text) {
	frontendMessage({'type': 'CRITICAL', 'title': 'PHP error', 'message': "PHP error in ajax request handler:\n" + text});
}

function jsonError(text) {
	frontendMessage({'type': 'CRITICAL', 'title': 'Syntax error', 'message': "Invalid JSON response:\n" + text});
}

/**
 * Function for creating a asynchronous GET request
 * - Uses query cache
 * - Response needs to be JS code or JSON => Parses the response with eval()
 * - Errors need to match following Regex: /^Notice:|^Warning:|^Error:|^Parse error:/
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function getAsyncRequest(sUrl, bCacheable, callback, callbackParams) {
	var sResponse = null;
	
	if(bCacheable === null)
		bCacheable = true;
	
	// Encode the url
	sUrl = sUrl.replace("+", "%2B");
	
	// use cache if last request is less than 30 seconds (30,000 milliseconds) ago
	if(bCacheable && typeof(ajaxQueryCache[sUrl]) !== 'undefined' && iNow - ajaxQueryCache[sUrl].timestamp <= ajaxQueryCacheLifetime) {
		// Prevent using invalid code in cache
		eventlog("ajax", "debug", "Using cached query");
		if(ajaxQueryCache[sUrl].response !== '')
			callback(eval('( '+ajaxQueryCache[sUrl].response+')'), callbackParams);
		else
			cleanupQueryCache(sUrl);
	} else {
		var oRequest = initXMLHttpClient();
		
		if(!oRequest)
			return false;
		
		oRequest.open("GET", sUrl+"&_t="+iNow);
		oRequest.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 2005 00:00:00 GMT");
		oRequest.onreadystatechange = function() {
			if(oRequest.readyState == 4) {
				if(oRequest.responseText.replace(/\s+/g, '').length === 0) {
					if(bCacheable)
						updateQueryCache(sUrl, iNow, '');
				} else {
					var responseText = oRequest.responseText.replace(/^\s+/,"");
					
					// Error handling for the AJAX methods
					if(responseText.match(/^Notice:|^Warning:|^Error:|^Parse error:/)) {
						phpError(responseText);
					} else if(responseText.match(/^NagVisError:/)) {
						frontendMessage(eval('( '+responseText.replace(/^NagVisError:/, '')+')'));
					} else {
						try {
							callback(eval('( '+responseText+')'), callbackParams);
							
							if(bCacheable)
								updateQueryCache(sUrl, iNow, responseText);
						} catch(e) {
							jsonError(responseText);
						}
						
					}
					
					responseText = null;
				}
			}
		}
		
		try {
			oRequest.send(null);
		} catch(e) {
			ajaxError(e);
		}
	}
}

/**
 * Function for creating a synchronous GET request
 * - Uses query cache
 * - Response needs to be JS code or JSON => Parses the response with eval()
 * - Errors need to match following Regex: /^Notice:|^Warning:|^Error:|^Parse error:/
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function getSyncRequest(sUrl, bCacheable, bRetryable) {
	var sResponse = null;
	var responseText;
	
	if(bCacheable === null)
		bCacheable = true;
	
	if(bRetryable === null)
		bRetryable = true;
	
	// Encode the url
	sUrl = sUrl.replace("+", "%2B");
	
	// use cache if last request is less than 30 seconds (30,000 milliseconds) ago
	if(bCacheable && typeof(ajaxQueryCache[sUrl]) !== 'undefined' && iNow - ajaxQueryCache[sUrl].timestamp <= ajaxQueryCacheLifetime) {
		eventlog("ajax", "debug", "Using cached query");
		responseText = ajaxQueryCache[sUrl].response;
		
		// Prevent using invalid code in cache
		if(responseText !== '') {
			sResponse = eval('( '+responseText+')');
		} else {
			// Remove the invalid code from cache
			cleanupQueryCache(sUrl);
		}
		
		responseText = null;
	} else {
		var oRequest = initXMLHttpClient();
		
		if(oRequest) {
			// Save this options to oOpt (needed for query cache)
			var url = sUrl;
			var timestamp = iNow;
			
			oRequest.open("GET", sUrl+"&_t="+timestamp, false);
			oRequest.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 2005 00:00:00 GMT");
			
			try {
				oRequest.send(null);
			} catch(e) {
				ajaxError(e);
				bCacheable = false;
			}
			
			responseText = oRequest.responseText;
			
			if(responseText.replace(/\s+/g, '').length === 0) {
				if(bCacheable) {
					// Cache that dialog
					updateQueryCache(url, timestamp, '');
				}
				
				sResponse = '';
			} else {
				// Trim the left of the response
				responseText = responseText.replace(/^\s+/,"");
				
				// Error handling for the AJAX methods
				if(responseText.match(/^Notice:|^Warning:|^Error:|^Parse error:/)) {
					phpError(responseText);
				} else if(responseText.match(/^NagVisError:/)) {
					responseText = responseText.replace(/^NagVisError:/, '');
					var oMsg = eval('( '+responseText+')');
					
					// Handle application message/error
					// FIXME: Param2: 30 and the message will be shown for maximum 30 seconds
					frontendMessage(oMsg);
					oMsg = null;
					
					// Clear the response
					sResponse = '';
					
					// Retry after sleep of x seconds for x times
					if(bRetryable) {
						// FIXME: Retry after short wait
						//for(var i = 0; i < 2 && sResponse == null; i++) {
						//	sResponse = getSyncRequest(sUrl, bCacheable, false);
						//}
					}
					
					//FIXME: Think about caching the error!
				} else {
					// Handle invalid response (No JSON format)
					try {
						sResponse = eval('( '+responseText+')');
					} catch(e) {
						var oMsg = {};
						oMsg.type = 'CRITICAL';
						oMsg.message = "Invalid JSON response:\n"+responseText;
						oMsg.title = "Syntax error";
						
						// Handle application message/error
						frontendMessage(oMsg);
						oMsg = null;
					
						// Clear the response
						sResponse = '';
					}
					
					if(sResponse !== null && bCacheable) {
						// Cache that answer (only when no error/warning/...)
						updateQueryCache(url, timestamp, responseText);
					}
					
					responseText = null;
				}
			}
			
			url = null;
			timestamp = null;
		}
		
		oRequest = null;
	}
	
	/*if(sResponse !== null && sResponse !== '') {
		if(typeof frontendMessageHide == 'function') { 
			frontendMessageHide();
		}
	}*/
	
	return sResponse;
}

/**
 * Prevent reaching too long urls, split the update to several 
 * requests. Just start the request and clean the string strUrl
 * Plus fire the rest of the request on the last iteration
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function getBulkRequest(sBaseUrl, aUrlParts, iLimit, bCacheable, handler, handlerParams) {
	var sUrl = '';
	var o;
	var aReturn = [];

	var async = false;
	if(typeof handler == 'function')
		async = true;
	
	eventlog("ajax", "debug", "Bulk parts: "+aUrlParts.length+" Async: "+ async);
	var count = 0
	for(var i = 0, len = aUrlParts.length; i < len; i++) {
		sUrl = sUrl + aUrlParts[i];
		count += 1;
		if(sUrl !== '' && (sBaseUrl.length + sUrl.length > iLimit || i == len - 1)) {
			eventlog("ajax", "debug", "Bulk go: "+ count);
			if(async)
				getAsyncRequest(sBaseUrl + sUrl, bCacheable, handler, handlerParams);
			else {
				o = getSyncRequest(sBaseUrl + sUrl, bCacheable);
				if(o)
					aReturn = aReturn.concat(o);
				o = null;
			}
			
			count = 0
			sUrl = '';
		}
	}
	return aReturn;
}

/**
 * Function for creating a synchronous POST request
 * - Response needs to be JS code or JSON => Parses the response with eval()
 * - Errors need to match following Regex: /^Notice:|^Warning:|^Error:|^Parse error:/
 *
 * @author	Lars Michelsen <lars@vertical-visions.de>
 */
function postSyncRequest(sUrl, sParams) {
	var oResponse = null;
	var responseText;
	
	// Encode the url
	sUrl = sUrl.replace("+", "%2B");
	
	var oRequest = initXMLHttpClient();
	
	if(oRequest) {
		oRequest.open("POST", sUrl+"&_t="+iNow, false);
		oRequest.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 2005 00:00:00 GMT");
		
		// Set post specific options
		oRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		oRequest.setRequestHeader("Content-length", sParams.length);
		oRequest.setRequestHeader("Connection", "close");
		
		try {
			oRequest.send(sParams);
		} catch(e) {
			ajaxError(e);
		}
		
		responseText = oRequest.responseText;
		
		if(oResponse === null && responseText.replace(/\s+/g, '').length !== 0) {
			// Trim the left of the response
			responseText = responseText.replace(/^\s+/,"");
			
			// Error handling for the AJAX methods
			if(responseText.match(/^Notice:|^Warning:|^Error:|^Parse error:/)) {
				oResponse = {};
				oResponse.type = 'CRITICAL';
				oResponse.message = "PHP error in ajax request handler:\n"+responseText;
				oResponse.title = "PHP error";
			} else if(responseText.match(/^NagVisError:/)) {
				responseText = responseText.replace(/^NagVisError:/, '');
				oResponse = eval('( '+responseText+')');
			} else {
				// Handle invalid response (No JSON format)
				try {
					oResponse = eval('( '+responseText+')');
				} catch(e) {
					oResponse = {};
					oResponse.type = 'CRITICAL';
					oResponse.message = "Invalid JSON response:\n"+responseText;
					oResponse.title = "Syntax error";
				}
				
				responseText = null;
			}
		}
	}
	
	oRequest = null;
	
	return oResponse;
}


/**
 * Parses all values from the given form to a string which
 * can be used in ajax queries
 *
 * @param   String    ID of the form
 * @return  String    Param string
 * @author  Lars Michelsen <lars@vertical-visions.de>
 */
function getFormParams(formId) {
	var sReturn = '';
	
	// Read form contents
	var oForm = document.getElementById(formId);
	
	if(typeof oForm === 'undefined') {
		return '';
	}
	
	// Get relevant input elements
	var aFields = oForm.getElementsByTagName('input');
	for(var i = 0, len = aFields.length; i < len; i++) {
		// Filter helper fields (NagVis WUI specific)
		if(aFields[i].name.charAt(0) !== '_') {
			// Skip options which use the default value
			var oFieldDefault = document.getElementById('_'+aFields[i].name);
			if(aFields[i] && oFieldDefault) {
				if(aFields[i].value === oFieldDefault.value) {
					continue;
				}
			}
			oFieldDefault = null;

			if(aFields[i].type == "hidden") {
				sReturn += aFields[i].name + "=" + escapeUrlValues(aFields[i].value) + "&";
			}
			
			if(aFields[i].type == "file") {
				sReturn += aFields[i].name + "=" + escapeUrlValues(aFields[i].value) + "&";
			}
			
			if(aFields[i].type == "text" || aFields[i].type == "password") {
				sReturn += aFields[i].name + "=" + escapeUrlValues(aFields[i].value) + "&";
			}
			
			if(aFields[i].type == "checkbox") {
				if(aFields[i].checked) {
					sReturn += aFields[i].name + "=" + escapeUrlValues(aFields[i].value) + "&";
				} else {
					sReturn += aFields[i].name + "=&";
				}
			}
			
			if(aFields[i].type == "radio") {
				if(aFields[i].checked) {
					sReturn += aFields[i].name + "=" + escapeUrlValues(aFields[i].value) + "&";
				}
			}
		}
	}
	
	// Get relevant select elements
	aFields = oForm.getElementsByTagName('select');
	for(var i = 0, len = aFields.length; i < len; i++) {
		// Filter helper fields (NagVis WUI specific)
		if(aFields[i].name.charAt(0) !== '_') {
			// Skip options which use the default value
			var oFieldDefault = document.getElementById('_'+aFields[i].name);
			if(aFields[i] && oFieldDefault) {
				if(aFields[i].value === oFieldDefault.value) {
					continue;
				}
			}
			oFieldDefault = null;
			
			// Maybe nothing is selected
			var sel = -1;
			if(aFields[i].selectedIndex != -1) {
				sel = aFields[i].selectedIndex;
			}
			
			if(typeof lang !== 'undefined' && (sel != -1 && aFields[i].options[aFields[i].selectedIndex].value === lang['manualInput'])) {
				sReturn += aFields[i].name + "=" + escapeUrlValues(document.getElementById('_inp_'+aFields[i].name).value) + "&";
			} else {
				// Can't use the selectedIndex when using select fields with multiple
				if(!aFields[i].multiple || aFields[i].multiple !== true) {
					// Maybe nothing is selected
					if(sel != -1) {
						sReturn += aFields[i].name + "=" + escapeUrlValues(aFields[i].options[sel].value) + "&";
					}
				} else {
					for(var a = 0; a < aFields[i].options.length; a++) {
						// Only add selected ones
						if(aFields[i].options[a].selected == true) {
							sReturn += aFields[i].name + "[]=" + escapeUrlValues(aFields[i].options[a].value) + "&";
						}
					}
				}
			}
		}
	}
	
	aFields = null;
	oForm = null;
	
	return sReturn;
}
