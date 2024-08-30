const apiKey = "AAPTxy8BH1VEsoebNVZXo8HurLMnZjbLeJmR2FcVXYvy8OQGDXiPVnzHH4cnjkvgI6elW4nZsd6w6xnOVhig_DzPq42RQXialzSphrx4TovbIu8bT8rwOwi-bcBb5B50Hk3fS8wJ2JC63fV78dvS7eygOXLgJkTtMAF3yfWBEn9Z_Pzp3CCJPpkGvqaG3ELRBbOOnusnznZ7XCClJV3Znr7MN5c4B5geYQB6uSs8VJWB8BY.AT1_s4bH8qga"
const getCategoriesList = async () => {
    const response = await fetch(`https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/categories?icon=svg&token=${apiKey}`, {
        method: "GET",
        headers: {
            'Accept': 'application/json'
        }
    })
    const body = await response.json()
    return body.categories
}
const categoriesList = await getCategoriesList();

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const closeButton = document.getElementById("closeButton");
const flowPanel = document.getElementById("flowPanel");
const resultsList = document.getElementById("resultList");
const alert = document.getElementById("alert");

// Buttons
const placeTypes = [
    {
        name: "Default",
        isButton: false,
        categoryIds: "",
        icon: "https://static.arcgis.com/icons/places/Default_15.svg"
    }, {
        name: "Restaurants",
        categoryIds: ["13065"],
        isButton: true,
        icon: "https://static.arcgis.com/icons/places/Restaurant_15.svg"
    }, {
        name: "Hotels",
        categoryIds: [
            "19014", "18061", "19018"
        ],
        isButton: true,
        icon: "https://static.arcgis.com/icons/places/Lodging_15.svg"
    }, {
        name: "Grocery",
        categoryIds: [
            "17069",
            "17070",
            "17071",
            "17072",
            "17073",
            "17077"
        ],
        isButton: true,
        icon: "https://static.arcgis.com/icons/places/Grocery_Store_15.svg"
    }, {
        name: "Coffee",
        categoryIds: [
            "13035", "17063"
        ],
        isButton: true,
        icon: "https://static.arcgis.com/icons/places/Coffee_or_Tea_15.svg"
    }, {
        name: "ATM",
        categoryIds: ["11044"],
        isButton: true,
        icon: "https://static.arcgis.com/icons/places/Bank_15.svg"
    }, {
        name: "Parks",
        categoryIds: [
            "16032", "16035", "16037", "16039"
        ],
        isButton: true,
        icon: "https://static.arcgis.com/icons/places/Park_15.svg"
    }, {
        name: "Fuel",
        categoryIds: [
            "19007", "19006"
        ],
        isButton: true,
        icon: "https://static.arcgis.com/icons/places/Gas_Station_15.svg"
    }
];

let processing = false;
let flowItem;

let activePlaceType = getPlaceType("Restaurants");
searchInput.value = activePlaceType.name;
let activeSearchText = null;
let activeLocation = null;
const radiusBase = 100;
const pageSize = 20;

placeTypes.forEach((placeType) => {
    if (!placeType.isButton)
        return;
    const categoryButton = L
        .DomUtil
        .create("calcite-chip", "categoryButton");
    categoryButton.setAttribute("scale", "s");
    categoryButton.setAttribute("kind", "neutral");
    categoryButton.setAttribute("appearance", "solid");
    categoryButton.setAttribute("value", placeType.name);
    categoryButton.innerHTML = placeType.name;
    if (placeType.name === "Restaurants") {
        categoryButton.setAttribute("selected", true);
    }
    categoryButton.addEventListener("calciteChipSelect", (e) => {
        if (processing)
            return;
        searchInput.value = placeType.name;
        activeSearchText = ""; // Don't use search text for strict searches
        activePlaceType = getPlaceType(e.currentTarget.value);
        getPlacesExtent();
    });

    const buttonAvatar = L
        .DomUtil
        .create("calcite-avatar");
    buttonAvatar.setAttribute("slot", "image");
    buttonAvatar.setAttribute("scale", "s");

    // get the icon url
    let icon = categoriesList
        .find((elt) => elt.categoryId == placeType.categoryIds[0])
        .icon
        .url;

    buttonAvatar.setAttribute("thumbnail", icon);
    categoryButton.append(buttonAvatar);

    categoryButtons.append(categoryButton);
});

function getPlaceType(name) {
    return placeTypes.find((placeType) => placeType.name === name);
}

const map = L
    .map("map", {
        minZoom: 13,
        maxZoom: 18
    })
    .setView([
        34.0566, -117.195
    ], 14); // Redlands, California

const authentication = arcgisRest
    .ApiKeyManager
    .fromKey(apiKey);

const basemapEnum = "arcgis/navigation";
L
    .esri
    .Vector
    .vectorBasemapLayer(basemapEnum, { apiKey: apiKey })
    .addTo(map);

map
    .zoomControl
    .setPosition("bottomright");

const radiusLayer = L
    .layerGroup()
    .addTo(map);
const placesLayer = L
    .layerGroup()
    .addTo(map);

// Get places in the map extent
async function getPlacesExtent() {
    if (!processing) {
        processing = true;
    } else {
        return;
    }

    clearPlaces();
    resetSearch(true);
    showAlert(false);
    radiusLayer.clearLayers();

    console.log("getPlacesExtent:" + activePlaceType);

    const bounds = map.getBounds();
    const topRight = bounds.getNorthEast();
    const bottomLeft = bounds.getSouthWest();
    const params = {
        xmin: bottomLeft.lng,
        ymin: bottomLeft.lat,
        xmax: topRight.lng,
        ymax: topRight.lat,
        categoryIds: activePlaceType.categoryIds,
        searchText: activeSearchText,
        pageSize,
        authentication
    };

    try {
        let response = await arcgisRest.findPlacesWithinExtent(params);
        if (response.results.length > 0) {
            showPanel(true);
            response
                .results
                .forEach((searchResult) => {
                    addMarker(searchResult);
                    addSearchResult(searchResult);
                });
            while (response.nextPage) {
                response = await response.nextPage();
                response
                    .results
                    .forEach((searchResult) => {
                        addMarker(searchResult);
                        addSearchResult(searchResult);
                    });
            }
        } else {
            showPanel(false);
            showAlert(true);
        }
    } catch (err) {
        showPanel(false);
        showAlert(true);
        console.log(err);
    }
    processing = false;
}

// Get places near the click point
async function getPlacesNearby(latLng) {
    if (!processing) {
        processing = true;
    } else {
        return;
    }

    clearPlaces();
    showAlert(false);

    const params = {
        x: latLng.lng,
        y: latLng.lat,
        categoryIds: activePlaceType.categoryIds,
        searchText: activeSearchText,
        radius: getRadius(),
        pageSize,
        authentication
    };

    try {
        let response = await arcgisRest.findPlacesNearPoint(params);
        if (response.results.length > 0) {
            showPanel(true);
            response
                .results
                .forEach((searchResult) => {
                    addMarker(searchResult);
                    addSearchResult(searchResult);
                });
            while (response.nextPage) {
                response = await response.nextPage();
                response
                    .results
                    .forEach((searchResult) => {
                        addMarker(searchResult);
                        addSearchResult(searchResult);
                    });
            }
        } else {
            showPanel(false);
            showAlert(true);
        }
    } catch (err) {
        showPanel(false);
        showAlert(true);
        console.log(err);
    }
    processing = false;
}

function addMarker(searchResult) {
    let icon = getIconMarkerLookUp(searchResult.categories);

    const marker = L
        .marker([
            searchResult.location.y, searchResult.location.x
        ], {
            autoPan: true,
            icon: icon
        })
        .bindPopup("<b>" + searchResult.name + "</b></br>" + searchResult.categories[0].label)
        .on("click", clickZoom)
        .addTo(placesLayer);
    marker.id = searchResult.placeId; // set place id
}

function getIconMarkerLookUp(categories) {
    let icon = categoriesList
        .find((elt) => elt.categoryId == categories[0].categoryId)
        .icon
        .url;
    const iconMarker = `<img src="${icon}" width="21px" height="21px">`;
    return L.divIcon({
        html: iconMarker,
        className: "marker-icon",
        iconAnchor: [
            10, 13
        ],
        popupAnchor: [0, -12]
    });
}

function findMarker(id) {
    return placesLayer
        .getLayers()
        .find((item) => item.id === id);
}

// Add each place to the result panel
function addSearchResult(searchResult) {
    const item = document.createElement("calcite-block");
    item.heading = searchResult.name;
    item.description = searchResult
        .categories[0]
        .label;
    item.id = searchResult.placeId;
    item.addEventListener("click", (e) => {
        getPlaceDetails(searchResult.placeId);
        goToPlace(searchResult.placeId, true);
    });
    resultsList.append(item);
}

// Get place details and display
async function getPlaceDetails(id) {
    const params = {
        placeId: id,
        requestedFields: ["all"],
        authentication
    };
    try {
        const result = await arcgisRest
            .getPlaceDetails(params)
            .then((result) => {
                showDetails(result.placeDetails);
            });
    } catch (err) {
        console.log(err);
    }
}

function showDetails(placeDetails) {
    if (flowItem) {
        flowItem.remove();
    }
    flowItem = document.createElement("calcite-flow-item");
    flowItem.setAttribute("id", placeDetails.placeId);
    flowItem.heading = placeDetails.name;
    flowItem.description = formatCategoryNames(placeDetails.categories);
    addBlock(
        "Description", "information", placeDetails
        ?.description);
    addBlock(
        "Address", "map-pin", placeDetails
            ?.address
        ?.streetAddress);
    addBlock(
        "Phone", "mobile", placeDetails
            ?.contactInfo
        ?.telephone);
    addBlock(
        "Hours", "clock", placeDetails
            ?.hours
        ?.openingText);
    addBlock(
        "Rating", "star", placeDetails
            ?.rating
        ?.user);
    addBlock(
        "Email", "email-address", placeDetails
            ?.contactInfo
        ?.email);
    addBlock(
        "Website", "information", placeDetails
            ?.contactInfo
            ?.website
            ?.split("://")[1].split("/")[0]);
    addBlock(
        "Facebook", "speech-bubble-social", placeDetails
            ?.socialMedia
            ?.facebookId
        ? `www.facebook.com/${placeDetails.socialMedia.facebookId}`
        : null);
    addBlock(
        "Twitter", "speech-bubbles", placeDetails
            ?.socialMedia
            ?.twitter
        ? `www.twitter.com/${placeDetails.socialMedia.twitter}`
        : null);
    addBlock(
        "Instagram", "camera", placeDetails
            ?.socialMedia
            ?.instagram
        ? `www.instagram.com/${placeDetails.socialMedia.instagram}`
        : null);
    flowItem.addEventListener("calciteFlowItemBack", closeItem);
    flowPanel.append(flowItem);
}

function formatCategoryNames(categories) {
    let categoryLabel = "";
    categories.forEach((category, i) => {
        categoryLabel += `${category.label} (${category.categoryId})`;
        categoryLabel += i < categories.length - 1
            ? ", "
            : "";
    });
    return categoryLabel;
}

function addBlock(heading, icon, validValue) {
    if (validValue) {
        const element = document.createElement("calcite-block");
        element.heading = heading;
        element.description = validValue;
        const attributeIcon = document.createElement("calcite-icon");
        attributeIcon.icon = icon;
        attributeIcon.slot = "icon";
        attributeIcon.scale = "m";
        element.append(attributeIcon);
        flowItem.append(element);
    }
}

function clearPlaces() {
    placesLayer.clearLayers();
    if (flowItem)
        flowItem.remove();
    resultsList.innerHTML = ""; // clear list
    map.closePopup();
}

function goToPlace(placeId, zoom) {
    const marker = findMarker(placeId);
    if (zoom) {
        map.flyTo(marker.getLatLng());
    }
    marker.openPopup();
}

function clickZoom(e) {
    getPlaceDetails(e.target.id, e.latLng);
}

function closeItem(item) {
    map.closePopup();
}

// Add circle to map and search
map.on("click", function (e) {
    if (processing)
        return;

    radiusLayer.clearLayers();
    resetSearch(true);

    L
        .circle(e.latlng, {
            stroke: 0,
            fillOpacity: 0.075,
            fillColor: "rgb(0,0,0)",
            radius: getRadius()
        })
        .addTo(radiusLayer);

    getPlacesNearby(e.latlng);
});

function getRadius() {
    let radius = radiusBase * (Math.exp(map.getMaxZoom() - map.getZoom()) / 3);
    radius = radius < 1000
        ? radius
        : 1000;
    return radius;
}

function showPanel(visible) {
    if (visible) {
        flowPanel
            .classList
            .remove("hide");
    } else {
        flowPanel
            .classList
            .add("hide");
    }
}

function showAlert(visible, message) {
    if (visible) {
        alert.removeAttribute("hidden");
        alert.open = true;
    } else {
        alert.open = false;
    }
}

function resetSearch(visible) {
    if (visible) {
        closeButton
            .classList
            .remove("hide");
    } else {
        closeButton
            .classList
            .add("hide");
    }
}

searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        activeSearchText = searchInput.value;
        activePlaceType = getPlaceType("Default");
        getPlacesExtent();
    }
});

searchButton.addEventListener("click", (e) => {
    activeSearchText = searchInput.value;
    activePlaceType = getPlaceType("Default");
    getPlacesExtent();
});

closeButton.addEventListener("click", (e) => {
    activeSearchText = searchInput.value = "";
    activePlaceType = getPlaceType("Default");
    showPanel(false);
    searchButton
        .classList
        .remove("hide");
    closeButton
        .classList
        .add("hide");
    radiusLayer.clearLayers();
    placesLayer.clearLayers();
    map.closePopup();
});

// Search on start up
getPlacesExtent();