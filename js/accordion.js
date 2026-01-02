document.addEventListener('DOMContentLoaded', function() {
    const items = document.querySelectorAll('.accordion-item');

    items.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all other items
            items.forEach(i => {
                if (i !== item) {
                    i.classList.remove('active');
                }
            });
            // Toggle active class on clicked item
            this.classList.toggle('active');
        });
        
        // Optional: keep expanded on hover for desktop (handled by CSS, but JS helps for persistent state)
        item.addEventListener('mouseenter', function() {
            items.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
});
