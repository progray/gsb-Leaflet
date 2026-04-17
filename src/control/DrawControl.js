
import {Control} from './Control.js';
import {LeafletMap} from '../map/Map.js';
import * as DomUtil from '../dom/DomUtil.js';
import * as DomEvent from '../dom/DomEvent.js';
import {Marker} from '../layer/marker/Marker.js';
import {Polyline} from '../layer/vector/Polyline.js';
import {Polygon} from '../layer/vector/Polygon.js';
import {Circle} from '../layer/vector/Circle.js';
import {FeatureGroup} from '../layer/FeatureGroup.js';

export class DrawControl extends Control {

	static {
		this.setDefaultOptions({
			position: 'topright',
			draw: {
				marker: true,
				polyline: true,
				polygon: true,
				circle: true
			},
			edit: {
				edit: true,
				remove: true
			}
		});
	}

	initialize(options) {
		super.initialize(options);
		this._activeTool = null;
		this._drawnLayers = new FeatureGroup();
		this._editMarkers = [];
		this._selectedLayer = null;
		this._mapInteractionState = {};

		this._currentDrawing = {
			type: null,
			points: [],
			tempLayer: null,
			isDrawing: false
		};
	}

	onAdd(map) {
		const container = DomUtil.create('div', 'leaflet-control-draw leaflet-bar');

		this._map = map;
		this._drawnLayers.addTo(map);

		if (this.options.draw.marker) {
			this._createButton('●', 'Draw Marker', 'leaflet-draw-marker', container, () => this._activateTool('marker'));
		}
		if (this.options.draw.polyline) {
			this._createButton('〰', 'Draw Polyline', 'leaflet-draw-polyline', container, () => this._activateTool('polyline'));
		}
		if (this.options.draw.polygon) {
			this._createButton('⬠', 'Draw Polygon', 'leaflet-draw-polygon', container, () => this._activateTool('polygon'));
		}
		if (this.options.draw.circle) {
			this._createButton('◯', 'Draw Circle', 'leaflet-draw-circle', container, () => this._activateTool('circle'));
		}

		if (this.options.edit.edit || this.options.edit.remove) {
			DomUtil.create('div', 'leaflet-draw-separator', container);
		}

		if (this.options.edit.edit) {
			this._createButton('✎', 'Edit Shape', 'leaflet-draw-edit', container, () => this._activateTool('edit'));
		}
		if (this.options.edit.remove) {
			this._createButton('✕', 'Delete Shape', 'leaflet-draw-delete', container, () => this._activateTool('delete'));
		}

		this._createButton('✖', 'Cancel', 'leaflet-draw-cancel', container, () => this._deactivateAllTools());

		return container;
	}

	onRemove() {
		this._deactivateAllTools();
		this._drawnLayers.remove();
	}

	_createButton(html, title, className, container, fn) {
		const link = DomUtil.create('a', className, container);
		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		link.setAttribute('role', 'button');
		link.setAttribute('aria-label', title);

		DomEvent.disableClickPropagation(link);
		DomEvent.on(link, 'click', DomEvent.stop);
		DomEvent.on(link, 'click', fn, this);
		DomEvent.on(link, 'click', this._refocusOnMap, this);

		return link;
	}

	_activateTool(tool) {
		if (this._activeTool === tool) {
			this._deactivateAllTools();
			return;
		}

		this._deactivateAllTools();

		this._activeTool = tool;
		this._updateButtonStates();
		this._disableMapInteraction();

		switch (tool) {
		case 'marker':
			this._startMarkerDraw();
			break;
		case 'polyline':
			this._startPolylineDraw();
			break;
		case 'polygon':
			this._startPolygonDraw();
			break;
		case 'circle':
			this._startCircleDraw();
			break;
		case 'edit':
			this._startEditMode();
			break;
		case 'delete':
			this._startDeleteMode();
			break;
		}
	}

	_deactivateAllTools() {
		if (!this._activeTool) { return; }

		switch (this._activeTool) {
		case 'marker':
			this._stopMarkerDraw();
			break;
		case 'polyline':
			this._stopPolylineDraw();
			break;
		case 'polygon':
			this._stopPolygonDraw();
			break;
		case 'circle':
			this._stopCircleDraw();
			break;
		case 'edit':
			this._stopEditMode();
			break;
		case 'delete':
			this._stopDeleteMode();
			break;
		}

		this._activeTool = null;
		this._updateButtonStates();
		this._restoreMapInteraction();
	}

	_updateButtonStates() {
		const container = this._container;
		if (!container) { return; }

		const buttons = container.querySelectorAll('a');
		buttons.forEach((btn) => {
			btn.classList.remove('leaflet-draw-active');
		});

		if (this._activeTool) {
			const activeButton = container.querySelector(`.leaflet-draw-${this._activeTool}`);
			if (activeButton) {
				activeButton.classList.add('leaflet-draw-active');
			}
		}
	}

	_disableMapInteraction() {
		const map = this._map;
		if (!map) { return; }

		this._mapInteractionState = {
			dragging: map.dragging?.enabled(),
			scrollWheelZoom: map.scrollWheelZoom?.enabled(),
			doubleClickZoom: map.doubleClickZoom?.enabled(),
			boxZoom: map.boxZoom?.enabled(),
			keyboard: map.keyboard?.enabled(),
			tapHold: map.tapHold?.enabled()
		};

		if (map.dragging?.enabled()) { map.dragging.disable(); }
		if (map.scrollWheelZoom?.enabled()) { map.scrollWheelZoom.disable(); }
		if (map.doubleClickZoom?.enabled()) { map.doubleClickZoom.disable(); }
		if (map.boxZoom?.enabled()) { map.boxZoom.disable(); }
		if (map.keyboard?.enabled()) { map.keyboard.disable(); }
		if (map.tapHold?.enabled()) { map.tapHold.disable(); }

		map.getContainer().classList.add('leaflet-crosshair');
	}

	_restoreMapInteraction() {
		const map = this._map;
		if (!map) { return; }

		const state = this._mapInteractionState;

		if (state.dragging && !map.dragging?.enabled()) { map.dragging.enable(); }
		if (state.scrollWheelZoom && !map.scrollWheelZoom?.enabled()) { map.scrollWheelZoom.enable(); }
		if (state.doubleClickZoom && !map.doubleClickZoom?.enabled()) { map.doubleClickZoom.enable(); }
		if (state.boxZoom && !map.boxZoom?.enabled()) { map.boxZoom.enable(); }
		if (state.keyboard && !map.keyboard?.enabled()) { map.keyboard.enable(); }
		if (state.tapHold && !map.tapHold?.enabled()) { map.tapHold.enable(); }

		map.getContainer().classList.remove('leaflet-crosshair');
		this._mapInteractionState = {};
	}

	_startMarkerDraw() {
		this._map.on('click', this._onMarkerClick, this);
	}

	_stopMarkerDraw() {
		this._map.off('click', this._onMarkerClick, this);
	}

	_onMarkerClick(e) {
		const marker = new Marker(e.latlng, {draggable: true});
		marker.addTo(this._drawnLayers);
		this._fireDrawEvent('draw:created', {layer: marker, layerType: 'marker'});
	}

	_startPolylineDraw() {
		this._currentDrawing = {
			type: 'polyline',
			points: [],
			tempLayer: null,
			isDrawing: false
		};
		this._map.on('click', this._onPolylineClick, this);
		this._map.on('mousemove', this._onPolylineMouseMove, this);
	}

	_stopPolylineDraw() {
		this._map.off('click', this._onPolylineClick, this);
		this._map.off('mousemove', this._onPolylineMouseMove, this);

		if (this._currentDrawing.tempLayer) {
			this._currentDrawing.tempLayer.remove();
			this._currentDrawing.tempLayer = null;
		}
		this._currentDrawing = {
			type: null,
			points: [],
			tempLayer: null,
			isDrawing: false
		};
	}

	_onPolylineClick(e) {
		DomEvent.stopPropagation(e);
		const latlng = e.latlng;
		const points = this._currentDrawing.points;

		if (points.length >= 2) {
			const lastPoint = points[points.length - 1];
			const dist = this._map.distance(lastPoint, latlng);

			if (dist < 20) {
				this._finishPolyline();
				return;
			}
		}

		points.push(latlng);
		this._currentDrawing.isDrawing = true;

		if (points.length === 1) {
			this._currentDrawing.tempLayer = new Polyline(points, {
				color: '#3388ff',
				weight: 3,
				opacity: 0.8,
				dashArray: '10, 10'
			});
			this._currentDrawing.tempLayer.addTo(this._map);
		} else {
			this._currentDrawing.tempLayer.setLatLngs(points);
		}
	}

	_onPolylineMouseMove(e) {
		if (!this._currentDrawing.isDrawing || !this._currentDrawing.tempLayer) {
			return;
		}

		const tempPoints = [...this._currentDrawing.points, e.latlng];
		this._currentDrawing.tempLayer.setLatLngs(tempPoints);
	}

	_finishPolyline() {
		const points = this._currentDrawing.points;
		if (points.length >= 2) {
			const polyline = new Polyline(points);
			polyline.addTo(this._drawnLayers);
			this._fireDrawEvent('draw:created', {layer: polyline, layerType: 'polyline'});
		}

		this._stopPolylineDraw();
		this._startPolylineDraw();
	}

	_startPolygonDraw() {
		this._currentDrawing = {
			type: 'polygon',
			points: [],
			tempLayer: null,
			isDrawing: false
		};
		this._map.on('click', this._onPolygonClick, this);
		this._map.on('mousemove', this._onPolygonMouseMove, this);
	}

	_stopPolygonDraw() {
		this._map.off('click', this._onPolygonClick, this);
		this._map.off('mousemove', this._onPolygonMouseMove, this);

		if (this._currentDrawing.tempLayer) {
			this._currentDrawing.tempLayer.remove();
			this._currentDrawing.tempLayer = null;
		}
		this._currentDrawing = {
			type: null,
			points: [],
			tempLayer: null,
			isDrawing: false
		};
	}

	_onPolygonClick(e) {
		DomEvent.stopPropagation(e);
		const latlng = e.latlng;
		const points = this._currentDrawing.points;

		if (points.length >= 3) {
			const firstPoint = points[0];
			const dist = this._map.distance(firstPoint, latlng);

			if (dist < 20) {
				this._finishPolygon();
				return;
			}
		}

		points.push(latlng);
		this._currentDrawing.isDrawing = true;

		if (points.length === 1) {
			this._currentDrawing.tempLayer = new Polygon(points, {
				color: '#3388ff',
				weight: 3,
				opacity: 0.8,
				fillOpacity: 0.2,
				dashArray: '10, 10'
			});
			this._currentDrawing.tempLayer.addTo(this._map);
		} else {
			this._currentDrawing.tempLayer.setLatLngs(points);
		}
	}

	_onPolygonMouseMove(e) {
		if (!this._currentDrawing.isDrawing || !this._currentDrawing.tempLayer) {
			return;
		}

		const tempPoints = [...this._currentDrawing.points, e.latlng];
		this._currentDrawing.tempLayer.setLatLngs(tempPoints);
	}

	_finishPolygon() {
		const points = this._currentDrawing.points;
		if (points.length >= 3) {
			const polygon = new Polygon(points);
			polygon.addTo(this._drawnLayers);
			this._fireDrawEvent('draw:created', {layer: polygon, layerType: 'polygon'});
		}

		this._stopPolygonDraw();
		this._startPolygonDraw();
	}

	_startCircleDraw() {
		this._currentDrawing = {
			type: 'circle',
			center: null,
			tempLayer: null,
			isDrawing: false
		};
		this._map.on('click', this._onCircleClick, this);
		this._map.on('mousemove', this._onCircleMouseMove, this);
	}

	_stopCircleDraw() {
		this._map.off('click', this._onCircleClick, this);
		this._map.off('mousemove', this._onCircleMouseMove, this);

		if (this._currentDrawing.tempLayer) {
			this._currentDrawing.tempLayer.remove();
			this._currentDrawing.tempLayer = null;
		}
		this._currentDrawing = {
			type: null,
			center: null,
			tempLayer: null,
			isDrawing: false
		};
	}

	_onCircleClick(e) {
		DomEvent.stopPropagation(e);
		const latlng = e.latlng;

		if (!this._currentDrawing.isDrawing) {
			this._currentDrawing.center = latlng;
			this._currentDrawing.isDrawing = true;
			this._currentDrawing.tempLayer = new Circle(latlng, {
				radius: 0,
				color: '#3388ff',
				weight: 3,
				opacity: 0.8,
				fillOpacity: 0.2,
				dashArray: '10, 10'
			});
			this._currentDrawing.tempLayer.addTo(this._map);
		} else {
			const radius = this._currentDrawing.tempLayer.getRadius();
			if (radius > 0) {
				const circle = new Circle(this._currentDrawing.center, {radius});
				circle.addTo(this._drawnLayers);
				this._fireDrawEvent('draw:created', {layer: circle, layerType: 'circle'});
			}

			this._stopCircleDraw();
			this._startCircleDraw();
		}
	}

	_onCircleMouseMove(e) {
		if (!this._currentDrawing.isDrawing || !this._currentDrawing.tempLayer) {
			return;
		}

		const radius = this._map.distance(this._currentDrawing.center, e.latlng);
		this._currentDrawing.tempLayer.setRadius(radius);
	}

	_startEditMode() {
		this._drawnLayers.eachLayer((layer) => {
			layer.on('click', this._onEditLayerClick, this);
			if (layer.setStyle) {
				layer.setStyle({weight: 4});
			}
		});
	}

	_stopEditMode() {
		this._clearEditMarkers();
		this._selectedLayer = null;
		this._drawnLayers.eachLayer((layer) => {
			layer.off('click', this._onEditLayerClick, this);
			if (layer.setStyle) {
				layer.setStyle({weight: 3});
			}
		});
	}

	_onEditLayerClick(e) {
		DomEvent.stopPropagation(e);
		const layer = e.layer || e.target;

		if (this._selectedLayer === layer) {
			this._clearEditMarkers();
			this._selectedLayer = null;
		} else {
			this._clearEditMarkers();
			this._selectedLayer = layer;
			this._createEditMarkers(layer);
		}
	}

	_startDeleteMode() {
		this._drawnLayers.eachLayer((layer) => {
			layer.on('click', this._onDeleteLayerClick, this);
			if (layer.setStyle) {
				layer.setStyle({color: '#ff0000'});
			}
		});
	}

	_stopDeleteMode() {
		this._drawnLayers.eachLayer((layer) => {
			layer.off('click', this._onDeleteLayerClick, this);
			if (layer.setStyle) {
				layer.setStyle({color: '#3388ff'});
			}
		});
	}

	_onDeleteLayerClick(e) {
		DomEvent.stopPropagation(e);
		const layer = e.layer || e.target;

		this._drawnLayers.removeLayer(layer);
		this._fireDrawEvent('draw:deleted', {layer});
	}

	_createEditMarkers(layer) {
		if (layer instanceof Marker) {
			return;
		}

		let latlngs = [];

		if (layer instanceof Circle) {
			const center = layer.getLatLng();

			this._createEditMarker(center, (newLatLng) => {
				layer.setLatLng(newLatLng);
			});

			const radius = layer.getRadius();
			const point = this._map.latLngToLayerPoint(center);
			const zoom = this._map.getZoom();
			const scale = this._map.getZoomScale(zoom, zoom);
			const edgePoint = point.add([radius / scale, 0]);
			const edgeLatLng = this._map.layerPointToLatLng(edgePoint);

			this._createEditMarker(edgeLatLng, (newLatLng) => {
				const newRadius = this._map.distance(center, newLatLng);
				layer.setRadius(newRadius);
			});

			return;
		}

		if (layer instanceof Polygon) {
			const layerLatLngs = layer.getLatLngs();
			latlngs = Array.isArray(layerLatLngs[0]) ? layerLatLngs[0] : layerLatLngs;
		} else if (layer instanceof Polyline) {
			latlngs = layer.getLatLngs();
		}

		if (!Array.isArray(latlngs)) {
			latlngs = [latlngs];
		}

		latlngs.forEach((latlng, index) => {
			this._createEditMarker(latlng, (newLatLng) => {
				const currentLatLngs = layer.getLatLngs();
				if (layer instanceof Polygon) {
					if (Array.isArray(currentLatLngs[0])) {
						currentLatLngs[0][index] = newLatLng;
					} else {
						currentLatLngs[index] = newLatLng;
					}
				} else {
					currentLatLngs[index] = newLatLng;
				}
				layer.setLatLngs(currentLatLngs);
			});
		});
	}

	_createEditMarker(latlng, onDrag) {
		const marker = new Marker(latlng, {
			draggable: true,
			icon: {
				createIcon: () => {
					const icon = DomUtil.create('div', 'leaflet-edit-marker');
					icon.style.width = '12px';
					icon.style.height = '12px';
					icon.style.backgroundColor = '#fff';
					icon.style.border = '2px solid #3388ff';
					icon.style.borderRadius = '50%';
					icon.style.cursor = 'move';
					return icon;
				},
				createShadow: () => null
			}
		});

		marker.on('drag', (e) => {
			onDrag(e.latlng);
		});

		marker.addTo(this._map);
		this._editMarkers.push(marker);
	}

	_clearEditMarkers() {
		this._editMarkers.forEach((marker) => {
			marker.remove();
		});
		this._editMarkers = [];
	}

	_fireDrawEvent(type, data) {
		if (this._map) {
			this._map.fire(type, data);
		}
	}

	getDrawnLayers() {
		return this._drawnLayers;
	}

	clearLayers() {
		this._drawnLayers.clearLayers();
		return this;
	}
}

LeafletMap.mergeOptions({
	drawControl: false
});

LeafletMap.addInitHook(function () {
	if (this.options.drawControl) {
		this.drawControl = new DrawControl();
		this.addControl(this.drawControl);
	}
});
