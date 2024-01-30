/* globals
canvas
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

import { elevationAtWaypoint } from "./segments.js";
import { ConstrainedTokenBorder } from "./ConstrainedTokenBorder.js";
import { Settings } from "./settings.js";

// Patches for the Token class
export const PATCHES = {};
PATCHES.TOKEN_RULER = {};
PATCHES.ConstrainedTokenBorder = {};

/**
 * Wrap Token.prototype._onDragLeftStart
 * Start a ruler measurement.
 */
function _onDragLeftStart(wrapped, event) {
  wrapped(event);

  // If Token Ruler, start a ruler measurement.
  if ( !Settings.get(Settings.KEYS.TOKEN_RULER.ENABLED) ) return;
  canvas.controls.ruler._onDragStart(event);
}

/**
 * Wrap Token.prototype._onDragLeftMove
 * Continue the ruler measurement
 */
function _onDragLeftCancel(wrapped, event) {
  const useTokenRuler = Settings.get(Settings.KEYS.TOKEN_RULER.ENABLED);
  const ruler = canvas.controls.ruler;

  if ( useTokenRuler
    && (event.button === 2 || event.ctrlKey)
    && ruler._state !== Ruler.STATES.MOVING ) {
    event.preventDefault();

    // Create waypoint
    Settings.toggleTokenRulerWaypoint(true);
    return;
  }

  wrapped(event);

  // Cancel a Ruler measurement.
  // If moving, handled by the drag left drop.
  if ( !useTokenRuler ) return;
  if ( ruler._state !== Ruler.STATES.MOVING ) canvas.controls.ruler._onMouseUp(event);
}

/**
 * Wrap Token.prototype._onDragLeftCancel
 * Continue the ruler measurement
 */
function _onDragLeftMove(wrapped, event) {
  wrapped(event);

  // Continue a Ruler measurement.
  if ( !Settings.get(Settings.KEYS.TOKEN_RULER.ENABLED) ) return;
  const ruler = canvas.controls.ruler;
  if ( ruler._state > 0 ) ruler._onMouseMove(event);
}

/**
 * Mix Token.prototype._onDragLeftDrop
 * End the ruler measurement.
 */
async function _onDragLeftDrop(wrapped, event) {
  // End the ruler measurement
  const ruler = canvas.controls.ruler;
  if ( !ruler.active || !Settings.get(Settings.KEYS.TOKEN_RULER.ENABLED) ) return wrapped(event);
  const destination = event.interactionData.destination;

  // Ensure the cursor destination is within bounds
  if ( !canvas.dimensions.rect.contains(destination.x, destination.y) ) {
    ruler._onMouseUp(event);
    return false;
  }
  ruler._state = Ruler.STATES.MOVING; // Do this before the await.
  await ruler.moveToken();
  ruler._onMouseUp(event);
}


PATCHES.TOKEN_RULER.WRAPS = {
  _onDragLeftStart,
  _onDragLeftMove,
};

PATCHES.TOKEN_RULER.MIXES = { _onDragLeftDrop, _onDragLeftCancel };

// ----- NOTE: Getters ----- //

/**
 * New getter: Token.prototype.constrainedTokenBorder
 * Determine the constrained border shape for this token.
 * @returns {ConstrainedTokenShape|PIXI.Rectangle}
 */
function constrainedTokenBorder() { return ConstrainedTokenBorder.get(this).constrainedBorder(); }

/**
 * New getter: Token.prototype.isConstrainedTokenBorder
 * Determine whether the border is currently constrained for this token.
 * I.e., the token overlaps a wall.
 * @returns {boolean}
 */
function isConstrainedTokenBorder() { return !ConstrainedTokenBorder.get(this)._unrestricted; }

/**
 * New getter: Token.prototype.tokenBorder
 * Determine the correct border shape for this token. Utilize the cached token shape.
 * @returns {PIXI.Polygon|PIXI.Rectangle}
 */
function tokenBorder() { return this.tokenShape.translate(this.x, this.y); }

/**
 * New getter: Token.prototype.tokenShape
 * Cache the token shape.
 * @type {PIXI.Polygon|PIXI.Rectangle}
 */
function tokenShape() { return this._tokenShape || (this._tokenShape = calculateTokenShape(this)); }

PATCHES.ConstrainedTokenBorder.GETTERS = {
  constrainedTokenBorder,
  tokenBorder,
  tokenShape,
  isConstrainedTokenBorder
};

// ----- NOTE: Helper functions ----- //
/**
 * Theoretical token shape at 0,0 origin.
 * @returns {PIXI.Polygon|PIXI.Rectangle}
 */
function calculateTokenShape(token) {
  // TODO: Use RegularPolygon shapes for use with WeilerAtherton
  // Hexagon (for width .5 or 1)
  // Square (for width === height)
  let shape;
  if ( canvas.grid.isHex ) {
    const pts = canvas.grid.grid.getBorderPolygon(token.document.width, token.document.height, 0);
    if ( pts ) shape = new PIXI.Polygon(pts);
  }

  return shape || new PIXI.Rectangle(0, 0, token.w, token.h);
}

