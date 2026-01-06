document.addEventListener('DOMContentLoaded', function() {
    const items = document.querySelectorAll('.accordion-item');

    items.forEach(item => {
        item.addEventListener('click', function(e) {
            // Check if we are on mobile (screen width < 768px)
            if (window.innerWidth < 768) {
                // If the item is NOT active, prevent navigation and expand it
                if (!this.classList.contains('active')) {
                    e.preventDefault(); // Stop the link from working
                    
                    // Remove active class from all other items
                    items.forEach(i => {
                        if (i !== item) {
                            i.classList.remove('active');
                        }
                    });
                    
                    // Add active class to clicked item
                    this.classList.add('active');
                }
                // If the item IS active, let the default action happen (navigate to link)
            }
            // On desktop, we just let the default click happen (navigation)
            // Hover handles the expansion
        });
        
        // Optional: keep expanded on hover for desktop (handled by CSS, but JS helps for persistent state)
        item.addEventListener('mouseenter', function() {
            items.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
});
