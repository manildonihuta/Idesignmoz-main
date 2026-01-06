$(document).ready(function(){
    
    // Inject Toast HTML
    $('body').append(`
        <div id="toast-notification">
            <i class="fa fa-check-circle toast-icon"></i>
            <span id="toast-message">Obrigado! Redirecionando para o WhatsApp...</span>
        </div>
    `);

    (function($) {
        "use strict";

    
    jQuery.validator.addMethod('answercheck', function (value, element) {
        return this.optional(element) || /^\bcat\b$/.test(value)
    }, "type the correct answer -_-");

    // validate contactForm form
    $(function() {
        $('#contactForm').validate({
            rules: {
                name: {
                    required: true,
                    minlength: 2
                },
                subject: {
                    required: true,
                    minlength: 4
                },
                number: {
                    required: true,
                    minlength: 5
                },
                email: {
                    required: true,
                    email: true
                },
                message: {
                    required: true,
                    minlength: 20
                }
            },
            messages: {
                name: {
                    required: "come on, you have a name, don't you?",
                    minlength: "your name must consist of at least 2 characters"
                },
                subject: {
                    required: "come on, you have a subject, don't you?",
                    minlength: "your subject must consist of at least 4 characters"
                },
                number: {
                    required: "come on, you have a number, don't you?",
                    minlength: "your Number must consist of at least 5 characters"
                },
                email: {
                    required: "no email, no message"
                },
                message: {
                    required: "um...yea, you have to write something to send this form.",
                    minlength: "thats all? really?"
                }
            },
            submitHandler: function(form) {
                var name = $('#name').val();
                var email = $('#email').val();
                var subject = $('#subject').val();
                var message = $('#message').val();
                
                // Show Toast
                var toast = $('#toast-notification');
                toast.addClass('show');
                
                setTimeout(function() {
                    var formattedMessage = "Name: " + name + "%0a" + "Email: " + email + "%0a" + "Subject: " + subject + "%0a" + "Message: " + message;
                    var whatsappUrl = "https://wa.me/258864321240?text=" + formattedMessage;
                    
                    window.open(whatsappUrl, '_blank');
                    
                    // Reset form and hide toast after delay
                    form.reset();
                    setTimeout(function() {
                        toast.removeClass('show');
                    }, 3000);
                }, 1500); // 1.5s delay to let user see the toast
            }
        })
    })
        
 })(jQuery)
})