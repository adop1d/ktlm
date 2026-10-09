package ktm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KtmApplication {

    public static void main(String[] args) {
        SpringApplication.run(KtmApplication.class, args);
    }

}