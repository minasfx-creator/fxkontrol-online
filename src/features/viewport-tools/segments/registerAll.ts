/**
 * Boots all segment plugins. Importing this module is the only way to
 * populate the registry — keep the import in the toolbar/host module.
 *
 * Per project rule: NO barrels for reliability modules. This file is a
 * pure side-effect aggregator (imports only), not a re-export hub.
 */

import './pyro.plugin';
import './drones.plugin';
import './light.plugin';
import './sfx.plugin';
import './dmx.plugin';
