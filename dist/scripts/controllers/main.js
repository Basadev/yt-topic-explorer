/*
  Copyright 2012 Google Inc. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

'use strict';

topicExplorerApp.controller('MainCtrl', ['$scope', '$rootScope', '$http', '$window', 'constants', 'youtube', function($scope, $rootScope, $http, $window, constants, youtube) {
  
  var opts = {color: '#FFF'};
  $rootScope.spinner = new Spinner(opts);
  $rootScope.spinner.spin($('#spinner')[0]);
  $rootScope.spinner.stop();
  
  $scope.changeLanguage = function (lang) {
	$rootScope.currentLanguage = lang;
  }
  
  $scope.topicSearch = function(searchTerm) {
    $scope.channelResults = [];
    $scope.playlistResults = [];
    $scope.videoResults = [];

    var data = lscache.get(searchTerm);
    if (data) {
      showTopics(data);
    } else {
      $rootScope.topicResults = [];
      $rootScope.spinner.spin($('#spinner')[0]); 
      var request = $http.jsonp(constants.FREEBASE_API_URL, {
        params: {
          query: searchTerm,
          key: constants.API_KEY,
          limit: constants.FREEBASE_API_MAX_RESULTS,
          callback: 'JSON_CALLBACK'
        }
      });
      request.success(function(data) {
        if (data.status == '200 OK') {
          lscache.set(searchTerm, data, constants.FREEBASE_CACHE_MINUTES);
          showTopics(data);
        }
      });
    }
  }

  function showTopics(data) {
    $rootScope.spinner.stop(); 
    $rootScope.topicResults = data.result.map(function(result) {
      var name = result.name;
      if (result.notable && result.notable.name) {
        name += ' (' + result.notable.name + ')';
      }

      var score = result.score;
      if (score > constants.MAX_SCORE) {
        score = constants.MAX_SCORE;
      }
      if (score < constants.MIN_SCORE) {
        score = constants.MIN_SCORE;
      }
	  
	  var maxheight = '';
	  if (score > 90) {
        maxheight = '&maxwidth=64&maxheight=64';
      }else{
	    maxheight = '&maxwidth=32&maxheight=32';
	  }
	  
      return {
        name: name,
        mid: result.mid,
		score: score,
		maxheight: maxheight,
		key: constants.API_KEY,
        style: {
          'font-size': score + '%',
          opacity: score / 100
        }
      }
    });
	
  }

  $scope.topicClicked = function(mid, name) {
    $scope.channelResults = [];
    $scope.playlistResults = [];
    $scope.videoResults = [];

    youtube({
      method: 'GET',
      service: 'search',
      params: {
        topicId: mid,
        part: 'snippet',
        type: 'channel,video',
        maxResults: constants.YOUTUBE_API_MAX_RESULTS,
        q: 'site:youtube.com'
      },
      callback: function(response) {
        $scope.$apply(function() {
          var videoResults = [];
          var channelResults = [];
          var playlistResults = [];

          if ('items' in response) {
            angular.forEach(response.items, function(result) {
              switch (result.id.kind) {
                case constants.VIDEO_KIND:
                  videoResults.push({
                    title: result.snippet.title,
                    thumbnailUrl: result.snippet.thumbnails.high.url,
                    id: result.id.videoId,
                    href: constants.YOUTUBE_VIDEO_PAGE_URL_PREFIX + result.id.videoId
                  });
                  break;
                case constants.CHANNEL_KIND:
                  channelResults.push({
                    title: result.snippet.title,
                    thumbnailUrl: result.snippet.thumbnails.high.url,
                    id: result.id.channelId,
                    href: constants.YOUTUBE_CHANNEL_PAGE_URL_PREFIX + result.id.channelId
                  });
                  break;
                case constants.PLAYLIST_KIND:
                  playlistResults.push({
                    title: result.snippet.title,
                    thumbnailUrl: result.snippet.thumbnails.high.url,
                    id: result.id.playlistId,
                    href: constants.YOUTUBE_PLAYLIST_PAGE_URL_PREFIX + result.id.playlistId
                  });
                  break;
              }
            });
          }

          $scope.channelResults = channelResults;
          $scope.playlistResults = playlistResults;
          $scope.videoResults = videoResults;
        });
      }
    });
  };

  $scope.addToList = function(target, listName, videoId) {
    var listId = $rootScope.relatedPlaylists[listName];

    target.textContent = topicExplorerApp.filter.i18n('ADDING');
    target.disabled = true;

    youtube({
      method: 'POST',
      service: 'playlistItems',
      params: {
        part: 'snippet'
      },
      body: {
        snippet: {
          playlistId: listId,
          resourceId: {
            kind: constants.VIDEO_KIND,
            videoId: videoId
          }
        }
      },
      callback: function(results) {
        if ('error' in results) {
          target.textContent = 'Error';
        } else {
          target.textContent = topicExplorerApp.filter.i18n('ADDED');
        }
      }
    });
  };

  $scope.videoClicked = function(target, videoId) {
    var container = target.parentElement;

    if (typeof(YT) != 'undefined' && typeof(YT.Player) != 'undefined') {
      playVideo(container, videoId);
    } else {
      $window.onYouTubeIframeAPIReady = function() {
        playVideo(container, videoId);
      };

      $http.jsonp(constants.IFRAME_API_URL);
    }
  };

  $scope.listPlayerClicked = function(target, listId) {
    var container = target.parentElement;

    if (typeof(YT) != 'undefined' && typeof(YT.Player) != 'undefined') {
      playList(container, listId);
    } else {
      $window.onYouTubeIframeAPIReady = function() {
        playList(container, listId);
      };

      $http.jsonp(constants.IFRAME_API_URL);
    }
  };

  $scope.subscribeClicked = function(target, channelId) {
    target.textContent = topicExplorerApp.filter.i18n('SUSCRIBING');
    target.disabled = true;

    youtube({
      method: 'POST',
      service: 'subscriptions',
      params: {
        part: 'snippet'
      },
      body: {
        snippet: {
          channelId: $rootScope.channelId,
          resourceId: {
            kind: constants.CHANNEL_KIND,
            channelId: channelId
          }
        }
      },
      callback: function(results) {
        if ('error' in results) {
          target.textContent = 'Error';
        } else {
          target.textContent = topicExplorerApp.filter.i18n('SUSCRIBED');
        }
      }
    });
  };

  function playList(container, listId) {
    listId = listId.replace(/^UC/, 'UU');

    var width = container.offsetWidth;
    var height = container.offsetHeight;

    new YT.Player(container, {
      width: width,
      height: height,
      playerVars: {
        listType: 'playlist',
        list: listId,
        autoplay: 1,
        controls: 2,
        modestbranding: 1,
        rel: 0,
        showInfo: 0
      }
    });
  }

  function playVideo(container, videoId) {
    var width = container.offsetWidth;
    var height = container.offsetHeight;

    new YT.Player(container, {
      videoId: videoId,
      width: width,
      height: height,
      playerVars: {
        autoplay: 1,
        controls: 2,
        modestbranding: 1,
        rel: 0,
        showInfo: 0
      }
    });
  }
}]);