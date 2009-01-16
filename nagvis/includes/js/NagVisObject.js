/*****************************************************************************
 *
 * NagVisObject.js - This class handles the visualisation of Nagvis objects
 *
 * Copyright (c) 2004-2008 NagVis Project
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

var NagVisObject = Base.extend({
	parsedObject: null,
	hover_template_code: null,
	context_template_code: null,
	conf: null,
	contextMenu: null,
	
	constructor: function(oConf) {
		// Initialize
		this.setLastUpdate();
		this.objId = getRandomLowerCaseLetter() + getRandom(1, 99999);
		this.conf = oConf;
	},
	
	/**
	 * PUBLIC setLastUpdate
	 *
	 * Sets the time of last status update of this object
	 *
	 * @author	Lars Michelsen <lars@vertical-visions.de>
	 */
	setLastUpdate: function() {
		this.lastUpdate = Date.parse(new Date());
	},
  
	/**
	 * PUBLIC getContextMenu()
	 *
	 * Creates a context menu for the object
	 *
	 * @author	Lars Michelsen <lars@vertical-visions.de>
	 */
	getContextMenu: function (sContainerId, sObjId) {
		// Only enable context menu when configured
		if(this.conf.context_menu && this.conf.context_menu == '1') {
			// Writes template code to "this.context_template_code"
			this.getContextTemplateCode();
			
			var oObj = document.getElementById(sObjId);
			var oContainer = document.getElementById(sContainerId);
			
			// Create context menu div
			var contextMenu = document.createElement('div');
			contextMenu.setAttribute('id', sObjId+'-context');
			contextMenu.setAttribute('class', 'context');
			contextMenu.setAttribute('className', 'context');
			contextMenu.style.zIndex = '1000';
			contextMenu.style.display = 'none';
			
			//var sTemplateCode = replaceHoverTemplateMacros('0', this, this.hover_template_code);
			//var iHoverDelay = this.conf.hover_delay;
			
			// Append template code to context menu div
			contextMenu.innerHTML = this.context_template_code;
			
			// Append context menu div to object container
			oContainer.appendChild(contextMenu);
			contextMenu = null;
			
			// Add eventhandlers for context menu
			oObj.onmousedown = contextMouseDown;
			oObj.oncontextmenu = contextShow;
			
			oContainer = null;
			oObj = null;
		}
  },
	
	/**
	 * getContextTemplateCode()
	 *
	 * Get the context template from the global object which holds all templates of 
	 * the map
	 *
	 * @return	String		HTML code for the hover box
	 * @author	Lars Michelsen <lars@vertical-visions.de>
	 */
	getContextTemplateCode: function() {
		this.context_template_code = oContextTemplates[this.conf.context_template];
	},
	
	/**
	 * PUBLIC getHoverMenu
	 *
	 * Creates a hover box for objects
	 *
	 * @author	Lars Michelsen <lars@vertical-visions.de>
	 */
	getHoverMenu: function (oObj) {
		// Only enable hover menu when configured
		if(this.conf.hover_menu && this.conf.hover_menu == '1') {
			// Parse the configured URL or get the hover menu
			if(this.conf.hover_url && this.conf.hover_url != '') {
				this.getHoverUrlCode();
			} else {
				this.getHoverTemplateCode();
			}
			
			// Resetting parsedObject. This causes problems in IE when converting to json with JSON.stringify
			// Maybe it results in other problems when removing parsedObject so clone this before
			var sTemplateCode = replaceHoverTemplateMacros('0', this, this.hover_template_code);
			var iHoverDelay = this.conf.hover_delay;
			
			// Add the hover menu functionality to the object
			oObj.onmouseover = function() { var sT = sTemplateCode; var iH = iHoverDelay; displayHoverMenu(sT, iH); sT = null; iH = null; };
			oObj.onmouseout = function() { hideHoverMenu(); };
		}
		
		oObj = null;
	},
	
	/**
	 * getHoverUrlCode()
	 *
	 * Get the hover code from the hover url
	 *
	 * @return	String		HTML code for the hover box
	 * @author	Lars Michelsen <lars@vertical-visions.de>
	 */
	getHoverUrlCode: function() {
		// FIXME: Move to bulk fetching like normal hover menus
		this.hover_template_code = oHoverUrls[this.conf.hover_url];
	},
	
	/**
	 * getHoverTemplateCode()
	 *
	 * Get the hover template from the global object which holds all templates of 
	 * the map
	 *
	 * @return	String		HTML code for the hover box
	 * @author	Lars Michelsen <lars@vertical-visions.de>
	 */
	getHoverTemplateCode: function() {
		this.hover_template_code = oHoverTemplates[this.conf.hover_template];
	}
});
