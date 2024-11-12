/**
 * Placement Excluder by Vincent van Pareren
 * version 2.0
 *
 * This script checks website and mobile application placements across Display and Demand Gen campaigns,
 * and excludes those that match certain terms. It then adds the excluded placements to a placement exclusion list in Google Ads.
 * Note: You must manually apply the exclusion list to the campaigns.
 *
 * Created by: Vincent van Pareren
 * Google Ads freelancer from Amsterdam
 * Follow or connect with me on LinkedIn 
 * https://www.linkedin.com/in/vincent-van-pareren/
 * 
 * You are free to use and modify this script, but please do not remove the creator's name or attempt to sell it.
 * 
 * Configuration:
 * - LOG: Enable or disable logging.
 * - EXCLUSIONS_LIST: Name of the exclusion list to which placements will be added.
 * - IMPRESSION_THRESHOLD: Minimum number of impressions to consider for exclusion.
 * - DAYS_TO_CHECK: Number of days to look back when checking placements.
 * - EXCLUDE_TERMS: Array of terms to exclude. These terms will be matched against the placement URLs. Add terms like this: "term",
 * - IGNORE_TERMS: Array of terms or URLs to ignore. If these terms appear in a matching term, the placement will not be excluded.
 * - MATCH_MODE: 'ENDS_WITH' to match the end of a URL, 'CONTAINS' to match anywhere in the URL.
 * - PLACEMENT_TYPES: Types of placements to check ('WEBSITE', 'MOBILE_APPLICATION').
 * - CAMPAIGN_TYPES: Types of campaigns to check ('DISPLAY', 'DEMAND_GEN').
 *   This list has suggestions on what terms to consider excluding
 *   https://docs.google.com/document/d/1VounvzeWZC9Pfpp7NZFyL4L2gfjmFI_8gfCejvPAfOk/edit
 ---------------------------------------------------------------------------------------
Explanation of The Script: 

This script automatically excludes certain website placements in Google Ads campaigns based on specific keywords (e.g., ".xyz", ".space") if they meet certain conditions. Here’s a breakdown in simple terms:

Configuration Section
Logging (LOG): Controls whether actions taken by the script are logged (set to true here).
Exclusion List (EXCLUSIONS_LIST): The name of the list where excluded URLs are saved.
Impression Threshold (IMPRESSION_THRESHOLD): Only URLs with impressions above this number are considered (set to 0 here, so all URLs with impressions are included).
Days to Check (DAYS_TO_CHECK): Limits how far back the script looks (30 days).
Exclude Terms (EXCLUDE_TERMS): Keywords to filter out certain URLs (like ".xyz", ".space", etc.).
Match Mode (MATCH_MODE): Specifies whether to exclude URLs containing the keyword anywhere ("CONTAINS") or only if they end with it ("ENDS_WITH").
Main Function: main
Date Calculation: The script calculates a date range from today back 30 days (based on DAYS_TO_CHECK).

Data Query: It queries Google Ads to get a list of URLs (placements) from campaigns that:

Are websites
Have impressions greater than IMPRESSION_THRESHOLD
Fall within the date range calculated.
Check Each URL:

For each placement URL retrieved, it checks if it contains or ends with any of the terms in EXCLUDE_TERMS (depending on MATCH_MODE).
If a match is found:
The script excludes that placement from the ad group.
It adds the URL to a specified exclusion list (EXCLUSIONS_LIST).
The script then logs each excluded URL for record-keeping.
Summary Log: After processing all placements, it logs the total number of URLs checked, excluded, and a list of all excluded URLs.

Helper Function: selectExclusionsList
This function checks if the exclusion list (EXCLUSIONS_LIST) exists in Google Ads:

If it exists, it retrieves it.
If not, it creates a new list with the specified name.
Summary
In essence, this script filters out low-quality placements by looking for unwanted keywords in website URLs associated with your ads. It then excludes any matched URLs and saves them in an exclusion list, which helps prevent future ad spending on those sites.

----------------------------------------------------------------------------------
 */

var config = {
  LOG: true,
  EXCLUSIONS_LIST: "Auto Excluded Placements",
  IMPRESSION_THRESHOLD: 0,
  DAYS_TO_CHECK: 60,
  EXCLUDE_TERMS: [
    "game",
    ".game",
    ".games",
    "games"
  ],
  IGNORE_TERMS: [
    "edu",
    "gov"
  ],
  MATCH_MODE: 'ENDS_WITH', // 'ENDS_WITH' to match the end of a URL, use 'CONTAINS' to match anywhere in the URL
  PLACEMENT_TYPES: ['WEBSITE', 'MOBILE_APPLICATION'], // 'WEBSITE' for website placements, 'MOBILE_APPLICATION' for phone placements
  CAMPAIGN_TYPES: ['DISPLAY', 'DEMAND_GEN'] // 'DISPLAY' for Display campaigns and 'DEMAND_GEN' for Demand Gen campaigns
};

// Don't change anything under this line. Altering code below this point may affect the script's functionality.

function main() {
  var excludedPlacements = 0;
  var checkedPlacements = 0;
  var ignoredPlacements = 0;
  var excludedPlacementUrls = [];

  // Calculate the date range for the report
  var today = new Date();
  var startDate = new Date(today.getTime() - (config.DAYS_TO_CHECK * 24 * 60 * 60 * 1000));
  var formattedToday = Utilities.formatDate(today, AdsApp.currentAccount().getTimeZone(), "yyyyMMdd");
  var formattedStartDate = Utilities.formatDate(startDate, AdsApp.currentAccount().getTimeZone(), "yyyyMMdd");

  Logger.log("Date range for the report: " + formattedStartDate + " to " + formattedToday);

  // Query for website and mobile application placements
  var query = "SELECT campaign.id, ad_group.id, group_placement_view.target_url " +
              "FROM group_placement_view " +
              "WHERE group_placement_view.placement_type IN ('" + config.PLACEMENT_TYPES.join("', '") + "') " +
              "AND metrics.impressions > " + config.IMPRESSION_THRESHOLD + " " +
              "AND segments.date BETWEEN '" + formattedStartDate + "' AND '" + formattedToday + "' " +
              "AND campaign.advertising_channel_type IN ('" + config.CAMPAIGN_TYPES.join("', '") + "')";

  Logger.log("Query: " + query);

  var report = AdsApp.report(query);
  var rows = report.rows();

  if (!rows.hasNext()) {
    Logger.log("No rows returned from the report. This could be due to:");
    Logger.log("1. The data range: " + formattedStartDate + " to " + formattedToday);
    Logger.log("2. The impression threshold: " + config.IMPRESSION_THRESHOLD);
    Logger.log("3. The placement types: " + config.PLACEMENT_TYPES.join(", "));
    Logger.log("4. The campaign types: " + config.CAMPAIGN_TYPES.join(", "));
  } else {
    while (rows.hasNext()) {
      var row = rows.next();
      var placementUrl = row['group_placement_view.target_url'];
      var campaignId = row['campaign.id'];
      var adGroupId = row['ad_group.id'];
      checkedPlacements++;

      if (shouldExcludePlacement(placementUrl)) {
        try {
          excludePlacement(campaignId, adGroupId, placementUrl);
          excludedPlacements++;
          excludedPlacementUrls.push(placementUrl);
          Logger.log("Excluded placement: " + placementUrl);
        } catch (e) {
          Logger.log("Error excluding placement: " + e.message);
        }
      }
    }

    // Log the total number of checked, excluded, and ignored placements
    Logger.log("Total placements checked: " + checkedPlacements);
    Logger.log("Total placements excluded: " + excludedPlacements);
    Logger.log("Total placements ignored: " + ignoredPlacements);
    Logger.log("Excluded Placements: " + excludedPlacementUrls.join(", "));
  }
}

function shouldExcludePlacement(url) {
  var lowerUrl = url.toLowerCase();
  
  for (var j = 0; j < config.IGNORE_TERMS.length; j++) {
    if (lowerUrl.includes(config.IGNORE_TERMS[j].toLowerCase())) {
      Logger.log("Ignored placement due to match with ignore term: " + config.IGNORE_TERMS[j] + " for URL: " + lowerUrl);
      return false; // Ignore this URL
    }
  }

  for (var i = 0; i < config.EXCLUDE_TERMS.length; i++) {
    var excludeTerm = config.EXCLUDE_TERMS[i].toLowerCase();
    var match = false;

    if (config.MATCH_MODE === 'ENDS_WITH') {
      match = lowerUrl.endsWith(excludeTerm);
    } else {
      match = lowerUrl.includes(excludeTerm);
    }

    if (match) {
      Logger.log("Matched exclude term: " + excludeTerm + " for URL: " + lowerUrl);
      return true; // Exclude this URL
    }
  }

  return false; // Do not exclude
}

function excludePlacement(campaignId, adGroupId, placementUrl) {
  var campaignIterator = AdsApp.campaigns().withIds([campaignId]).get();
  if (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var adGroupIterator = campaign.adGroups().withIds([adGroupId]).get();
    if (adGroupIterator.hasNext()) {
      var adGroup = adGroupIterator.next();
      // Use the URL to directly exclude it
      adGroup.display().newPlacementBuilder().withUrl(placementUrl).exclude();

      // Add the placement to a placement exclusion list
      var excludedPlacementList = selectExclusionsList(config.EXCLUSIONS_LIST);
      if (excludedPlacementList) {
        excludedPlacementList.addExcludedPlacement(placementUrl);
        Logger.log("Added placement to exclusion list: " + placementUrl);
      }
    } else {
      Logger.log("Ad group not found: " + adGroupId);
    }
  } else {
    Logger.log("Campaign not found: " + campaignId);
  }
}

function selectExclusionsList(name) {
  var listIterator = AdsApp.excludedPlacementLists().withCondition("Name = '" + name + "'").get();
  if (listIterator.hasNext()) {
    return listIterator.next();
  } else {
    return AdsApp.newExcludedPlacementListBuilder().withName(name).build();
  }
}

