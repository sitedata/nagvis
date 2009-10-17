<?php
class FrontendModAutoMap extends FrontendModule {
	private $name;
	private $opts;
	
	public function __construct(GlobalCore $CORE) {
		$this->CORE = $CORE;

		// Parse the view specific options
		$aOpts = Array('show' => MATCH_MAP_NAME,
		               'backend' => MATCH_STRING_NO_SPACE_EMPTY,
		               'root' => MATCH_STRING_NO_SPACE_EMPTY,
		               'maxLayers' => MATCH_INTEGER_EMPTY,
		               'renderMode' => MATCH_AUTOMAP_RENDER_MODE,
		               'width' => MATCH_INTEGER_EMPTY,
		               'height' => MATCH_INTEGER_EMPTY,
		               'ignoreHosts' => MATCH_STRING_NO_SPACE_EMPTY,
		               'filterGroup' => MATCH_STRING_NO_SPACE_EMPTY);
		
		$aVals = $this->getCustomOptions($aOpts);
		$this->name = $aVals['show'];
		unset($aVals['show']);
		$this->opts = $aVals;
		
		$this->aActions = Array(
			'view' => REQUIRES_AUTHORISATION
		);
	}
	
	public function handleAction() {
		$sReturn = '';
		
		if($this->offersAction($this->sAction)) {
			switch($this->sAction) {
				case 'view':
					// Show the view dialog to the user
					$sReturn = $this->showViewDialog();
				break;
			}
		}
		
		return $sReturn;
	}
	
	private function showViewDialog() {
		// Initialize backend(s)
		$BACKEND = new GlobalBackendMgmt($this->CORE);
		
    // Initialize map configuration
    $MAPCFG = new NagVisAutomapCfg($this->CORE, $this->name);
    // Read the map configuration file
    $MAPCFG->readMapConfig();

		// Build index template
		$INDEX = new NagVisIndexView($this->CORE);

		//FIXME: Rotation properties not supported atm
    //$FRONTEND->addBodyLines($FRONTEND->parseJs('oRotationProperties = '.$FRONTEND->getRotationPropertiesJson(0).';'));
		
		// Need to load the custom stylesheet?
		$customStylesheet = $MAPCFG->getValue('global',0, 'stylesheet');
		if($customStylesheet !== '') {
			$INDEX->setCustomStylesheet($CORE->MAINCFG->getValue('paths','htmlstyles') . $customStylesheet);
		}
		
		// Need to parse the header menu?
		if($MAPCFG->getValue('global',0 ,'header_menu')) {
      // Parse the header menu
      $HEADER = new GlobalHeaderMenu($this->CORE, $MAPCFG->getValue('global',0 ,'header_template'), $MAPCFG);
			$INDEX->setHeaderMenu($HEADER->__toString());
    }

		// Initialize map view
		$this->VIEW = new NagVisAutoMapView($this->CORE, $MAPCFG->getName());
		
		// Render the automap
		$AUTOMAP = new NagVisAutoMap($this->CORE, $MAPCFG, $BACKEND, $this->opts);
		$this->VIEW->setContent($AUTOMAP->parseMap());
		
    //FIXME: Maintenance mode not supported atm
		//$this->MAP->MAPOBJ->checkMaintenance(1);
		
    $INDEX->setContent($this->VIEW->parse());

		return $INDEX->parse();
	}
}
?>
