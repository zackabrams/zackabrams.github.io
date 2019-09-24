/** 
 * ===================================================================
 * main js
 *
 * ------------------------------------------------------------------- 
 */ 

(function($) {
    
   

	"use strict";

	/*---------------------------------------------------- */
	/* Preloader
	------------------------------------------------------ */ 
   $(window).load(function() {

      // will first fade out the loading animation 
    	$("#loader").fadeOut("slow", function(){

        // will fade out the whole DIV that covers the website.
        $("#preloader").delay(300).fadeOut("slow");

      });       

  	})


  	/*---------------------------------------------------- */
  	/* FitText Settings
  	------------------------------------------------------ */
  	setTimeout(function() {

   	$('#intro h1').fitText(1, { minFontSize: '42px', maxFontSize: '84px' });

  	}, 100);


	/*---------------------------------------------------- */
	/* FitVids
	------------------------------------------------------ */ 
  	$(".fluid-video-wrapper").fitVids();
    
    var $img = $('.thing');

$img.waypoint(function (direction) {
    
    if (direction === "down"){

                            var data4 = google.visualization.arrayToDataTable([
                            ['Time of Day', 'Reaction Count'],
                            [{v: 0, f:'Midnight'}, null],
                            [{v: 360, f:'6 AM'}, null],
                            [{v: 720, f:'Noon'}, null],
                            [{v: 1080, f:'6 PM'}, null],
                            [{v: 1440, f:'Midnight'}, null],
                            [61, 735], [80, 166], [234, 169], [482, 1169], [492, 1367], [546, 71], [566, 7], [593, 560], [612, 5], [648, 557], [654, 42], [686, 359], [695, 224], [709, 388], [720, 224], [730, 40], [731, 47], [732, 276], [751, 516], [755, 424], [767, 123], [773, 875], [773, 317], [779, 8], [790, 293], [805, 156], [812, 304], [813, 847], [816, 212], [817, 325], [818, 18], [830, 271], [833, 221], [841, 478], [846, 173], [851, 1514], [862, 247], [863, 217], [898, 62], [906, 455], [918, 10], [919, 619], [926, 236], [927, 114], [930, 586], [941, 484], [944, 33], [947, 65], [963, 283], [980, 395], [992, 895], [1009, 1117], [1013, 146], [1033, 72], [1041, 9], [1043, 95], [1043, 28], [1048, 39], [1060, 55], [1062, 446], [1070, 60], [1073, 36], [1075, 1297], [1091, 59], [1107, 320], [1110, 266], [1112, 31], [1130, 248], [1136, 1012], [1144, 381], [1145, 550], [1156, 419], [1161, 84],[1183, 120], [1190, 44], [1200, 413], [1205, 658], [1216, 38], [1223, 1699], [1226, 102], [1231, 757], [1286, 394], [1286, 111], [1289, 84], [1292, 141], [1298, 207], [1314, 39],  [1319, 89], [1326, 39],  [1334, 202], [1342, 993], [1342, 168], [1347, 390], [1356, 148], [1363, 58], [1381, 822], [1403, 719], [1424, 202], [1431, 125], [1435, 47]
                                          ]);
    }
                            
      // Optional; add a title and set the width and height of the chart

      var options4 = {
          width:'100%',
          chartArea: {width: '45%', left:'20%'},
          title: 'Time Posted vs. Total Reactions',
          legend: 'right',
          backgroundColor:'#EBEBEB',
          animation: {
          duration: 4000,
          easing: 'inAndOut',
          startup: true,
              },
          trendlines: {
    0: {
      type: 'linear',
      color: 'green',
      lineWidth: 3,
      opacity: 0.3,
      showR2: true,
      visibleInLegend: true
    }
  },
          titleTextStyle: { color: 'black',
  fontSize: 18,
  bold: true,
  },
          hAxis: {
    ticks: [{v:0, f:'Midnight'}, {v:360, f:'6 AM'}, {v:720, f:'Noon'}, {v:1080, f:'6 PM'}, {v:1440, f:'Midnight'}] 
},  
        };
                     
                            
                     

      var chart4 = new google.visualization.ScatterChart(document.getElementById('scatterchart'));
      chart4.draw(data4,options4);                
    
    });
    
var cloud = document.getElementById('cloud');
    var waypoint = new Waypoint({ 
    element: cloud,
    handler: function (direction) {
         cloud.classList.add('animate')
    },
        offset: 400
})
    var cloud2 = document.getElementById('cloud2');
    var waypoint = new Waypoint({ 
    element: cloud2,
    handler: function (direction) {
         cloud2.classList.add('animate')
 
    },
        offset: 400
})
    var cloud3 = document.getElementById('cloud3');
    var waypoint = new Waypoint({ 
    element: cloud3,
    handler: function (direction) {
         cloud3.classList.add('animate')
 
    },
        offset: 400
})
    var cloud4 = document.getElementById('cloud4');
    var waypoint = new Waypoint({ 
    element: cloud4,
    handler: function (direction) {
         cloud4.classList.add('animate')

    },
        offset: 400
})




	/*---------------------------------------------------- */
	/* Owl Carousel
	------------------------------------------------------ */ 
	$("#owl-slider").owlCarousel({
        navigation: false,
        pagination: true,
        itemsCustom : [
	        [0, 1],
	        [700, 2],
	        [960, 3]
	     ],
        navigationText: false
    });


	/*----------------------------------------------------- */
	/* Alert Boxes
  	------------------------------------------------------- */
	$('.alert-box').on('click', '.close', function() {
	  $(this).parent().fadeOut(500);
	});	


	/*----------------------------------------------------- */
	/* Stat Counter
  	------------------------------------------------------- */
   var statSection = $("#stats"),
       stats = $(".stat-count");

   statSection.waypoint({

   	handler: function(direction) {

      	if (direction === "down") {       		

			   stats.each(function () {
				   var $this = $(this);

				   $({ Counter: 0 }).animate({ Counter: $this.text() }, {
				   	duration: 4000,
				   	easing: 'swing',
				   	step: function (curValue) {
				      	$this.text(Math.ceil(curValue));
				    	}
				  	});
				});

       	} 

       	// trigger once only
       	this.destroy();      	

		},
			
		offset: "90%"
	
	});	


	/*---------------------------------------------------- */
	/*	Masonry
	------------------------------------------------------ */
	var containerProjects = $('#folio-wrapper');

	containerProjects.imagesLoaded( function() {

		containerProjects.masonry( {		  
		  	itemSelector: '.folio-item',
		  	resize: true 
		});

	});


	/*----------------------------------------------------*/
	/*	Modal Popup
	------------------------------------------------------*/
   $('.item-wrap a').magnificPopup({

      type:'inline',
      fixedContentPos: false,
      removalDelay: 300,
      showCloseBtn: false,
      mainClass: 'mfp-fade'

   });

   $(document).on('click', '.popup-modal-dismiss', function (e) {
   	e.preventDefault();
   	$.magnificPopup.close();
   });

	
	/*-----------------------------------------------------*/
  	/* Navigation Menu
   ------------------------------------------------------ */  
   var toggleButton = $('.menu-toggle'),
       nav = $('.main-navigation');

   // toggle button
   toggleButton.on('click', function(e) {

		e.preventDefault();
		toggleButton.toggleClass('is-clicked');
		nav.slideToggle();

	});

   // nav items
  	nav.find('li a').on("click", function() {   

   	// update the toggle button 		
   	toggleButton.toggleClass('is-clicked'); 
   	// fadeout the navigation panel
   	nav.fadeOut();   		
   	     
  	});


   /*---------------------------------------------------- */
  	/* Highlight the current section in the navigation bar
  	------------------------------------------------------ */
	var sections = $("section"),
	navigation_links = $("#main-nav-wrap li a");	

	sections.waypoint( {

       handler: function(direction) {

		   var active_section;

			active_section = $('section#' + this.element.id);

			if (direction === "up") active_section = active_section.prev();

			var active_link = $('#main-nav-wrap a[href="#' + active_section.attr("id") + '"]');			

         navigation_links.parent().removeClass("current");
			active_link.parent().addClass("current");

		}, 

		offset: '25%'
	});


	/*---------------------------------------------------- */
  	/* Smooth Scrolling
  	------------------------------------------------------ */
  	$('.smoothscroll').on('click', function (e) {
	 	
	 	e.preventDefault();

   	var target = this.hash,
    	$target = $(target);

    	$('html, body').stop().animate({
       	'scrollTop': $target.offset().top
      }, 800, 'swing', function () {
      	window.location.hash = target;
      });

  	});  
  

   /*---------------------------------------------------- */
	/*  Placeholder Plugin Settings
	------------------------------------------------------ */ 
	$('input, textarea, select').placeholder()  


  	/*---------------------------------------------------- */
	/*	contact form
	------------------------------------------------------ */

	/* local validation */
	$('#contactForm').validate({

		/* submit via ajax */
		submitHandler: function(form) {

			var sLoader = $('#submit-loader');

			$.ajax({      	

		      type: "POST",
		      url: "inc/sendEmail.php",
		      data: $(form).serialize(),
		      beforeSend: function() { 

		      	sLoader.fadeIn(); 

		      },
		      success: function(msg) {

	            // Message was sent
	            if (msg == 'OK') {
	            	sLoader.fadeOut(); 
	               $('#message-warning').hide();
	               $('#contactForm').fadeOut();
	               $('#message-success').fadeIn();   
	            }
	            // There was an error
	            else {
	            	sLoader.fadeOut(); 
	               $('#message-warning').html(msg);
		            $('#message-warning').fadeIn();
	            }

		      },
		      error: function() {

		      	sLoader.fadeOut(); 
		      	$('#message-warning').html("Something went wrong. Please try again.");
		         $('#message-warning').fadeIn();

		      }

	      });     		
  		}

	});
    



 	/*----------------------------------------------------- */
  	/* Back to top
   ------------------------------------------------------- */ 
	var pxShow = 300; // height on which the button will show
	var fadeInTime = 400; // how slow/fast you want the button to show
	var fadeOutTime = 400; // how slow/fast you want the button to hide
	var scrollSpeed = 300; // how slow/fast you want the button to scroll to top. can be a value, 'slow', 'normal' or 'fast'

   // Show or hide the sticky footer button
	jQuery(window).scroll(function() {

		if (!( $("#header-search").hasClass('is-visible'))) {

			if (jQuery(window).scrollTop() >= pxShow) {
				jQuery("#go-top").fadeIn(fadeInTime);
			} else {
				jQuery("#go-top").fadeOut(fadeOutTime);
			}

		}		

	});		

})(jQuery);